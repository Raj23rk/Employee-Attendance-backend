import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Department, DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
  ) {}

  // 1. Directory search with filters
  async searchDirectory(query: { search?: string; department?: string; campus?: string }) {
    const filter: any = { isActive: true };

    if (query.department && query.department !== 'ALL') {
      filter.department = query.department;
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
      .select('name employeeId email role department designation phone avatarUrl')
      .sort({ name: 1 })
      .exec();

    return { success: true, count: users.length, data: users };
  }

  // 2. Organization hierarchy tree
  async getOrgTree() {
    const allUsers = await this.userModel
      .find({ isActive: true })
      .select('name employeeId email role department designation managerId avatarUrl')
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
      // Seed default departments if none
      depts = [
        await this.departmentModel.create({ name: 'Technology', code: 'TECH', description: 'Core software engineering and infrastructure' }),
        await this.departmentModel.create({ name: 'Skill Campus', code: 'SKILL', description: 'Vocational training and student placement' }),
        await this.departmentModel.create({ name: 'B School', code: 'BSCH', description: 'Business management education' }),
        await this.departmentModel.create({ name: 'Executive & Admin', code: 'EXEC', description: 'Leadership and administrative operations' }),
      ];
    }

    return { success: true, count: depts.length, data: depts };
  }
}
