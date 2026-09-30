import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
  ) {}

  // 1. Directory search with filters (department, branch, search keyword)
  async searchDirectory(query: { search?: string; department?: string; branch?: string; campus?: string }) {
    const filter: any = { isActive: true };

    if (query.department && query.department !== 'ALL') {
      filter.department = query.department;
    }
    if (query.branch && query.branch !== 'ALL') {
      filter.branch = query.branch;
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
        { designation: { $regex: query.search, $options: 'i' } },
      ];
    }

    const users = await this.userModel
      .find(filter)
      .select('name employeeId email role department designation branch phone avatarUrl dateOfJoining')
      .sort({ name: 1 })
      .lean();

    return { success: true, count: users.length, data: users };
  }

  // 2. Organization hierarchy tree
  async getOrgTree() {
    const allUsers = await this.userModel
      .find({ isActive: true })
      .select('name employeeId email role department designation branch managerId avatarUrl')
      .lean();

    const userMap = new Map<string, any>();
    allUsers.forEach((u: any) => {
      userMap.set(u._id.toString(), {
        id: u._id,
        name: u.name,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        department: u.department,
        designation: u.designation,
        branch: u.branch || 'Chennai Main Campus',
        avatarUrl: u.avatarUrl,
        managerId: u.managerId ? u.managerId.toString() : null,
        children: [],
      });
    });

    const rootNodes = [];
    userMap.forEach((node) => {
      if (node.managerId && userMap.has(node.managerId)) {
        userMap.get(node.managerId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return { success: true, data: rootNodes };
  }

  // 3. Departments list
  async getDepartments() {
    let depts = await this.departmentModel.find().populate('leadId', 'name email designation').lean();

    if (depts.length === 0) {
      depts = [
        await this.departmentModel.create({ name: 'Technology', code: 'TECH', description: 'Core software engineering and infrastructure' }),
        await this.departmentModel.create({ name: 'Skill Campus', code: 'SKILL', description: 'Vocational training and student placement' }),
        await this.departmentModel.create({ name: 'B School', code: 'BSCH', description: 'Business management education' }),
        await this.departmentModel.create({ name: 'Executive & Admin', code: 'EXEC', description: 'Leadership and administrative operations' }),
      ] as any;
    }

    return { success: true, count: depts.length, data: depts };
  }

  // 4. Multi-Branch Management - Dynamic only
  async getBranches() {
    const [branches, userCounts] = await Promise.all([
      this.branchModel.find().populate('branchHeadId', 'name email').sort({ name: 1 }).lean(),
      this.userModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$branch', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map<string, number>();
    userCounts.forEach((c) => countMap.set(c._id, c.count));

    const branchStats = branches.map((b: any) => ({
      ...b,
      employeeCount: countMap.get(b.name) || 0,
    }));

    return { success: true, count: branchStats.length, data: branchStats };
  }

  async getBranchById(id: string) {
    const branch = await this.branchModel.findById(id).populate('branchHeadId', 'name email designation').exec();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    const employeeCount = await this.userModel.countDocuments({
      $or: [{ branch: branch.name }, { branchId: branch._id }],
      isActive: true,
    });
    return { success: true, data: { ...branch.toObject(), employeeCount } };
  }

  async createBranch(dto: CreateBranchDto) {
    const existing = await this.branchModel.findOne({
      $or: [{ name: dto.name }, { code: dto.code.toUpperCase() }],
    });
    if (existing) {
      throw new ConflictException('A branch with this name or code already exists');
    }

    const branch = await this.branchModel.create({
      ...dto,
      state: dto.state || 'Tamil Nadu',
      code: dto.code.toUpperCase(),
      branchHeadId: dto.branchHeadId ? new Types.ObjectId(dto.branchHeadId) : undefined,
    });

    return {
      success: true,
      message: 'Office branch created successfully',
      data: branch,
    };
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const branch = await this.branchModel.findById(id);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (dto.code) {
      dto.code = dto.code.toUpperCase();
    }

    const updated = await this.branchModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...dto,
          branchHeadId: dto.branchHeadId ? new Types.ObjectId(dto.branchHeadId) : branch.branchHeadId,
        },
      },
      { new: true },
    );

    return {
      success: true,
      message: 'Branch updated successfully',
      data: updated,
    };
  }

  async deleteBranch(id: string) {
    const branch = await this.branchModel.findById(id);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check if employees are assigned to this branch
    const employeeCount = await this.userModel.countDocuments({
      $or: [{ branch: branch.name }, { branchId: branch._id }],
    });

    if (employeeCount > 0) {
      // Soft-delete / deactivate
      branch.isActive = false;
      await branch.save();
      return {
        success: true,
        message: `Branch deactivated successfully (${employeeCount} employees currently assigned).`,
      };
    }

    await this.branchModel.findByIdAndDelete(id);
    return {
      success: true,
      message: 'Branch deleted successfully',
    };
  }
}

