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
      .exec();

    return { success: true, count: users.length, data: users };
  }

  // 2. Organization hierarchy tree
  async getOrgTree() {
    const allUsers = await this.userModel
      .find({ isActive: true })
      .select('name employeeId email role department designation branch managerId avatarUrl')
      .exec();

    const userMap = new Map<string, any>();
    allUsers.forEach((u) => {
      userMap.set(u._id.toString(), {
        id: u._id,
        name: u.name,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        department: u.department,
        designation: u.designation,
        branch: (u as any).branch || 'Chennai Main Campus',
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
    let depts = await this.departmentModel.find().populate('leadId', 'name email designation').exec();

    if (depts.length === 0) {
      depts = [
        await this.departmentModel.create({ name: 'Technology', code: 'TECH', description: 'Core software engineering and infrastructure' }),
        await this.departmentModel.create({ name: 'Skill Campus', code: 'SKILL', description: 'Vocational training and student placement' }),
        await this.departmentModel.create({ name: 'B School', code: 'BSCH', description: 'Business management education' }),
        await this.departmentModel.create({ name: 'Executive & Admin', code: 'EXEC', description: 'Leadership and administrative operations' }),
      ];
    }

    return { success: true, count: depts.length, data: depts };
  }

  // 4. Multi-Branch Management (Initial 3 Branches + Dynamic Additions)
  async getBranches() {
    let branches = await this.branchModel.find().populate('branchHeadId', 'name email').sort({ name: 1 }).exec();

    if (branches.length === 0) {
      // Seed default 3 company branches
      await this.branchModel.insertMany([
        {
          name: 'Chennai Main Campus',
          code: 'CHN-01',
          address: 'Block A, Wegrow Knowledge Park, OMR',
          city: 'Chennai',
          state: 'Tamil Nadu',
          latitude: 12.9716,
          longitude: 80.2436,
          radiusMeters: 500,
          contactEmail: 'chennai.office@wegrow.edu.in',
          contactPhone: '+91 44 2847 1100',
          isActive: true,
        },
        {
          name: 'Bangalore Tech Hub',
          code: 'BLR-02',
          address: '4th Floor, Tech Innovation Center, Whitefield',
          city: 'Bangalore',
          state: 'Karnataka',
          latitude: 12.9698,
          longitude: 77.7499,
          radiusMeters: 500,
          contactEmail: 'bangalore.hub@wegrow.edu.in',
          contactPhone: '+91 80 4123 9900',
          isActive: true,
        },
        {
          name: 'Hyderabad Branch',
          code: 'HYD-03',
          address: 'Survey No. 64, HITEC City, Madhapur',
          city: 'Hyderabad',
          state: 'Telangana',
          latitude: 17.4483,
          longitude: 78.3915,
          radiusMeters: 500,
          contactEmail: 'hyderabad.branch@wegrow.edu.in',
          contactPhone: '+91 40 6789 2200',
          isActive: true,
        },
      ]);
      branches = await this.branchModel.find().populate('branchHeadId', 'name email').sort({ name: 1 }).exec();
    }

    // Attach current employee count per branch
    const branchStats = await Promise.all(
      branches.map(async (b) => {
        const employeeCount = await this.userModel.countDocuments({
          $or: [{ branch: b.name }, { branchId: b._id }],
          isActive: true,
        });
        return {
          ...b.toObject(),
          employeeCount,
        };
      }),
    );

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

