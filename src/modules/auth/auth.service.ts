import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, RegisterDto } from './dto/auth.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Role } from '../../common/enums/role.enum';
import { Gender } from '../../common/enums/gender.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  async register(dto: RegisterDto, creatorUser?: any) {
    const role = dto.role || Role.EMPLOYEE;
    const gender = dto.gender || Gender.MALE;

    let managerId = dto.managerId;
    if (!managerId && creatorUser && creatorUser.role === Role.MANAGER) {
      managerId = creatorUser.id;
    }

    return this.usersService.create({
      ...dto,
      role,
      gender,
      department: dto.department || 'General',
      designation: dto.designation || 'Staff',
      managerId,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({
        $or: [{ email: dto.identifier.toLowerCase() }, { employeeId: dto.identifier }],
      })
      .select('+password')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email/employee ID or inactive account');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomBytes(40).toString('hex');

    user.refreshToken = refreshToken;
    await user.save();

    return {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        department: user.department,
        designation: user.designation,
        managerId: user.managerId,
      },
    };
  }

  async logout(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
    return { success: true, message: 'Logged out successfully' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const user = await this.userModel
      .findOne({ refreshToken: dto.refreshToken })
      .select('+refreshToken')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = crypto.randomBytes(40).toString('hex');

    user.refreshToken = newRefreshToken;
    await user.save();

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user) {
      // Don't leak user existence
      return { success: true, message: 'If an account exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Trigger notification
    await this.notificationsService.sendEmail(user.email, 'PASSWORD_RESET', {
      name: user.name,
      token: resetToken,
      link: `http://localhost:5173/reset-password?token=${resetToken}`,
    });

    return {
      success: true,
      message: 'Password reset link sent to your email',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.userModel
      .findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      })
      .select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return { success: true, message: 'Password has been reset successfully' };
  }
}
