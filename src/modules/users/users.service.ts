import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateProfileDto, ChangePasswordDto } from './dto/users.dto';
import { LeaveBalance, LeaveBalanceDocument } from '../leaves/schemas/leave-balance.schema';
import { Gender } from '../../common/enums/gender.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LeaveBalance.name) private leaveBalanceModel: Model<LeaveBalanceDocument>,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.userModel.findOne({
      $or: [{ email: dto.email.toLowerCase() }, { employeeId: dto.employeeId }],
    });
    if (existing) {
      throw new ConflictException('User with this email or employee ID already exists');
    }

    const plainPassword =
      dto.password || this.generateEmployeePassword(dto.name || dto.email || dto.employeeId);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const createdUser = await this.userModel.create({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });

    // Auto-allocate gender-specific leave balance
    // Women: Maternity leave (182 days / 26 weeks)
    // Men: 3 days paid Paternity / new child birth leave
    await this.leaveBalanceModel.create({
      userId: createdUser._id,
      year: new Date().getFullYear(),
      annual: 15,
      casual: 12,
      sick: 10,
      maternity: dto.gender === Gender.FEMALE ? 182 : 0,
      paternity: dto.gender === Gender.MALE ? 3 : 0,
      lossOfPay: 0,
    });

    const userObj = createdUser.toObject();
    delete userObj.password;

    return {
      success: true,
      message: 'Employee onboarded successfully',
      data: {
        ...userObj,
        initialPassword: plainPassword,
      },
    };
  }

  generateEmployeePassword(nameOrIdentifier: string): string {
    const clean = (nameOrIdentifier.split('@')[0] || 'Emp').replace(/[^a-zA-Z]/g, '');
    const prefix =
      clean.length >= 3
        ? clean.charAt(0).toUpperCase() + clean.slice(1, 3).toLowerCase()
        : (clean.charAt(0).toUpperCase() + clean.slice(1) + 'xyz').slice(0, 3);
    const digit1 = Math.floor(Math.random() * 9) + 1;
    const symbols = ['#', '!', '$'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const l1 = upper[Math.floor(Math.random() * upper.length)];
    const l2 = lower[Math.floor(Math.random() * lower.length)];
    const digits2 = Math.floor(10 + Math.random() * 90);

    return `WG@${prefix}${digit1}${symbol}${l1}${l2}${digits2}`;
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmailOrEmployeeId(identifier: string) {
    return this.userModel
      .findOne({
        $or: [{ email: identifier.toLowerCase() }, { employeeId: identifier }],
      })
      .select('+password')
      .exec();
  }

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('managerId', 'name email employeeId designation')
      .select('-password')
      .lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, data: user };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .select('-password')
      .lean();
    return { success: true, message: 'Profile updated successfully', data: updated };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { success: true, message: 'Password changed successfully' };
  }

  async findAll(query: { search?: string; department?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.department && query.department !== 'ALL') {
      filter.department = query.department;
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate('managerId', 'name employeeId')
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 })
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: users,
    };
  }

  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own logged-in account');
    }
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    await Promise.all([
      this.userModel.findByIdAndDelete(id),
      this.leaveBalanceModel.deleteMany({ userId: id }),
    ]);

    return {
      success: true,
      message: `Employee ${user.name} (${user.employeeId}) removed successfully`,
    };
  }

  async cleanSeedData(currentUserId: string) {
    const seedEmails = [
      'priya.sharma@wegrow.edu.in',
      'vijay.kumaran@wegrow.edu.in',
      'manager@wegrow.edu.in',
      'ceo@wegrow.edu.in',
      'rajkumar@wegrow.edu.in',
    ];

    const usersToDelete = await this.userModel.find({
      email: { $in: seedEmails },
      _id: { $ne: currentUserId },
    });

    const idsToDelete = usersToDelete.map((u) => u._id);

    if (idsToDelete.length > 0) {
      await Promise.all([
        this.userModel.deleteMany({ _id: { $in: idsToDelete } }),
        this.leaveBalanceModel.deleteMany({ userId: { $in: idsToDelete } }),
      ]);
    }

    return {
      success: true,
      message: `Successfully removed ${idsToDelete.length} static demo employee accounts`,
      deletedEmployees: usersToDelete.map((u) => ({ id: u._id, name: u.name, email: u.email })),
    };
  }
}
