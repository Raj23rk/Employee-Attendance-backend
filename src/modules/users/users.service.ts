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
    if (!dto.email.toLowerCase().endsWith('@wegrow.edu.in')) {
      throw new BadRequestException('Only official @wegrow.edu.in email addresses are allowed');
    }

    const existing = await this.userModel.findOne({
      $or: [{ email: dto.email.toLowerCase() }, { employeeId: dto.employeeId }],
    });
    if (existing) {
      throw new ConflictException('User with this email or employee ID already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
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
      data: userObj,
    };
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
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, data: user };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .select('-password')
      .exec();
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
        .exec(),
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
}
