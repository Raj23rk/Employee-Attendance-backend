import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Leave, LeaveDocument } from './schemas/leave.schema';
import {
  LeaveBalance,
  LeaveBalanceDocument,
} from './schemas/leave-balance.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ApplyLeaveDto, ReviewLeaveDto } from './dto/leaves.dto';
import { LeaveType, LeaveStatus } from '../../common/enums/leave-type.enum';
import { Gender } from '../../common/enums/gender.enum';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(Leave.name) private leaveModel: Model<LeaveDocument>,
    @InjectModel(LeaveBalance.name)
    private balanceModel: Model<LeaveBalanceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // 1. GET BALANCES
  async getBalances(userId: string) {
    let balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!balance) {
      const user = await this.userModel.findById(userId);
      balance = await this.balanceModel.create({
        userId: new Types.ObjectId(userId),
        year: new Date().getFullYear(),
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: user?.gender === Gender.FEMALE ? 182 : 0,
        paternity: user?.gender === Gender.MALE ? 3 : 0,
        lossOfPay: 0,
      });
    }

    return { success: true, data: balance };
  }

  // 2. APPLY LEAVE (With Maternity and 3-Day Paid Paternity Rules)
  async applyLeave(userId: string, dto: ApplyLeaveDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Gender-based Parental Leave Validations
    if (dto.leaveType === LeaveType.MATERNITY) {
      if (user.gender !== Gender.FEMALE) {
        throw new BadRequestException('Maternity leave is applicable only for female employees');
      }
    }

    if (dto.leaveType === LeaveType.PATERNITY) {
      if (user.gender !== Gender.MALE) {
        throw new BadRequestException('Paternity leave is applicable only for male employees');
      }
      if (dto.days > 3) {
        throw new BadRequestException('Paternity leave cannot exceed 3 paid days per application');
      }
    }

    // Check balance
    const balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (balance) {
      if (dto.leaveType === LeaveType.CASUAL && balance.casual < dto.days) {
        throw new BadRequestException(`Insufficient casual leave balance. Available: ${balance.casual}`);
      }
      if (dto.leaveType === LeaveType.SICK && balance.sick < dto.days) {
        throw new BadRequestException(`Insufficient sick leave balance. Available: ${balance.sick}`);
      }
      if (dto.leaveType === LeaveType.ANNUAL && balance.annual < dto.days) {
        throw new BadRequestException(`Insufficient annual leave balance. Available: ${balance.annual}`);
      }
      if (dto.leaveType === LeaveType.PATERNITY && balance.paternity < dto.days) {
        throw new BadRequestException(`Insufficient paternity leave balance. Available: ${balance.paternity}`);
      }
      if (dto.leaveType === LeaveType.MATERNITY && balance.maternity < dto.days) {
        throw new BadRequestException(`Insufficient maternity leave balance. Available: ${balance.maternity}`);
      }
    }

    const leave = await this.leaveModel.create({
      userId: new Types.ObjectId(userId),
      leaveType: dto.leaveType,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      days: dto.days,
      reason: dto.reason,
      documentUrl: dto.documentUrl || '',
      status: LeaveStatus.PENDING,
    });

    // Notify manager if assigned
    if (user.managerId) {
      const manager = await this.userModel.findById(user.managerId);
      if (manager) {
        await this.notificationsService.createInAppNotification(
          manager._id.toString(),
          'New Leave Application',
          `${user.name} applied for ${dto.days} day(s) of ${dto.leaveType} leave.`,
          'INFO',
          '/leaves/team-requests',
        );

        await this.notificationsService.sendEmail(
          manager.email,
          'LEAVE_SUBMITTED',
          {
            managerName: manager.name,
            employeeName: user.name,
            leaveType: dto.leaveType,
            days: dto.days,
            fromDate: dto.fromDate,
            toDate: dto.toDate,
            reason: dto.reason,
          },
        );
      }
    }

    return {
      success: true,
      message: 'Leave application submitted successfully',
      data: leave,
    };
  }

  // 3. MY LEAVE HISTORY
  async getMyHistory(userId: string) {
    const list = await this.leaveModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
    return { success: true, count: list.length, data: list };
  }

  // 4. CANCEL LEAVE
  async cancelLeave(leaveId: string, userId: string) {
    const leave = await this.leaveModel.findOne({
      _id: leaveId,
      userId: new Types.ObjectId(userId),
    });

    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    if (leave.status === LeaveStatus.REJECTED || leave.status === LeaveStatus.CANCELLED) {
      throw new BadRequestException(`Leave is already ${leave.status.toLowerCase()}`);
    }

    // If it was already approved, refund the balance
    if (leave.status === LeaveStatus.APPROVED) {
      await this.refundBalance(leave.userId.toString(), leave.leaveType, leave.days);
    }

    leave.status = LeaveStatus.CANCELLED;
    await leave.save();

    return { success: true, message: 'Leave application cancelled', data: leave };
  }

  // 5. MANAGER / HR: TEAM LEAVE REQUESTS
  async getTeamRequests(reviewerId: string, role: Role) {
    const filter: any = { status: LeaveStatus.PENDING };

    if (role === Role.MANAGER) {
      const reportees = await this.userModel.find({
        managerId: new Types.ObjectId(reviewerId),
      }).select('_id');
      const reporteeIds = reportees.map((r) => r._id);
      filter.userId = { $in: reporteeIds };
    }

    const requests = await this.leaveModel
      .find(filter)
      .populate('userId', 'name employeeId email department gender')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: requests.length, data: requests };
  }

  // 6. MANAGER / HR: REVIEW LEAVE
  async reviewLeave(leaveId: string, reviewerId: string, dto: ReviewLeaveDto) {
    const leave = await this.leaveModel.findById(leaveId);
    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave application has already been ${leave.status.toLowerCase()}`);
    }

    leave.status = dto.action === 'APPROVE' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    leave.reviewedBy = new Types.ObjectId(reviewerId);
    leave.reviewComments = dto.comments || '';
    leave.reviewedAt = new Date();
    await leave.save();

    // Deduct balance on approval
    if (dto.action === 'APPROVE') {
      await this.deductBalance(leave.userId.toString(), leave.leaveType, leave.days);
    }

    // Notify employee
    const applicant = await this.userModel.findById(leave.userId);
    if (applicant) {
      await this.notificationsService.createInAppNotification(
        applicant._id.toString(),
        `Leave Request ${dto.action}`,
        `Your ${leave.leaveType} leave request from ${leave.fromDate} to ${leave.toDate} was ${dto.action.toLowerCase()}d.`,
        dto.action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        '/leaves/my-history',
      );

      await this.notificationsService.sendEmail(
        applicant.email,
        'LEAVE_STATUS_CHANGED',
        {
          name: applicant.name,
          leaveType: leave.leaveType,
          status: dto.action,
          comments: dto.comments || 'Reviewed',
        },
      );
    }

    return {
      success: true,
      message: `Leave application ${dto.action.toLowerCase()}d successfully`,
      data: leave,
    };
  }

  // 7. PUBLIC / TEAM LEAVE CALENDAR
  async getLeaveCalendar(month?: number, year?: number) {
    const targetDate = new Date();
    const y = year || targetDate.getFullYear();
    const m = month || targetDate.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaves = await this.leaveModel
      .find({
        status: LeaveStatus.APPROVED,
        $or: [
          { fromDate: { $gte: startStr, $lte: endStr } },
          { toDate: { $gte: startStr, $lte: endStr } },
        ],
      })
      .populate('userId', 'name department employeeId')
      .exec();

    return { success: true, month: m, year: y, count: leaves.length, data: leaves };
  }

  private async deductBalance(userId: string, leaveType: LeaveType, days: number) {
    const balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!balance) return;

    if (leaveType === LeaveType.CASUAL) balance.casual = Math.max(0, balance.casual - days);
    else if (leaveType === LeaveType.SICK) balance.sick = Math.max(0, balance.sick - days);
    else if (leaveType === LeaveType.ANNUAL) balance.annual = Math.max(0, balance.annual - days);
    else if (leaveType === LeaveType.MATERNITY) balance.maternity = Math.max(0, balance.maternity - days);
    else if (leaveType === LeaveType.PATERNITY) balance.paternity = Math.max(0, balance.paternity - days);
    else if (leaveType === LeaveType.LOSS_OF_PAY) balance.lossOfPay += days;

    await balance.save();
  }

  private async refundBalance(userId: string, leaveType: LeaveType, days: number) {
    const balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!balance) return;

    if (leaveType === LeaveType.CASUAL) balance.casual += days;
    else if (leaveType === LeaveType.SICK) balance.sick += days;
    else if (leaveType === LeaveType.ANNUAL) balance.annual += days;
    else if (leaveType === LeaveType.MATERNITY) balance.maternity += days;
    else if (leaveType === LeaveType.PATERNITY) balance.paternity += days;
    else if (leaveType === LeaveType.LOSS_OF_PAY) balance.lossOfPay = Math.max(0, balance.lossOfPay - days);

    await balance.save();
  }
}
