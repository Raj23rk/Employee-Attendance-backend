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

    // Calculate casual leave used in current calendar month (1 CL allowed per month)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const monthStartStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEndStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const monthlyCasualLeaves = await this.leaveModel.find({
      userId: new Types.ObjectId(userId),
      leaveType: { $in: [LeaveType.CASUAL, LeaveType.HALF_DAY] },
      status: { $in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
      $or: [
        { fromDate: { $gte: monthStartStr, $lte: monthEndStr } },
        { toDate: { $gte: monthStartStr, $lte: monthEndStr } },
      ],
    });

    const casualDaysUsedThisMonth = monthlyCasualLeaves.reduce((acc, l) => acc + (l.paidDays || l.days), 0);

    return {
      success: true,
      data: {
        ...balance.toObject(),
        monthlyRules: {
          casualAllowedPerMonth: 1,
          casualUsedThisMonth: casualDaysUsedThisMonth,
          casualRemainingThisMonth: Math.max(0, 1 - casualDaysUsedThisMonth),
          medicalCertificateRequiredForSickLeave: true,
        },
      },
    };
  }

  // 2. APPLY LEAVE (With 1 CL / Month Quota, Half Day option & Medical Certificate Mandatory for Sick Leave)
  async applyLeave(userId: string, dto: ApplyLeaveDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isHalfDay = dto.isHalfDay || dto.leaveType === LeaveType.HALF_DAY;
    const requestedDays = isHalfDay ? 0.5 : (dto.days || 1);
    const halfDaySession = dto.halfDaySession || (isHalfDay ? 'FIRST_HALF' : '');

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
      if (requestedDays > 3) {
        throw new BadRequestException('Paternity leave cannot exceed 3 paid days per application');
      }
    }

    let balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!balance) {
      balance = await this.balanceModel.create({
        userId: new Types.ObjectId(userId),
        year: new Date().getFullYear(),
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: user.gender === Gender.FEMALE ? 182 : 0,
        paternity: user.gender === Gender.MALE ? 3 : 0,
        lossOfPay: 0,
      });
    }

    let isLop = false;
    let lopDays = 0;
    let paidDays = requestedDays;
    let lopReason = '';

    const medCertUrl = dto.medicalCertificateUrl || dto.documentUrl || '';

    // Rule 1: Medical / Sick Leave REQUIRES medical certificate, otherwise LOP
    if (dto.leaveType === LeaveType.SICK) {
      if (!medCertUrl || medCertUrl.trim() === '') {
        isLop = true;
        lopDays = requestedDays;
        paidDays = 0;
        lopReason = 'Medical certificate not uploaded for sick leave (Treated as Loss of Pay)';
      } else if (balance.sick < requestedDays) {
        const availableSick = Math.max(0, balance.sick);
        paidDays = availableSick;
        lopDays = requestedDays - availableSick;
        isLop = true;
        lopReason = `Insufficient sick leave balance (${balance.sick} available, ${lopDays} days LOP)`;
      }
    }

    // Rule 2: Casual Leave & Half Day: 1 leave per calendar month. Excess days are LOP.
    if (dto.leaveType === LeaveType.CASUAL || dto.leaveType === LeaveType.HALF_DAY) {
      const fromDateObj = new Date(dto.fromDate);
      const m = fromDateObj.getMonth() + 1;
      const y = fromDateObj.getFullYear();
      const monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const monthEndStr = `${y}-${String(m).padStart(2, '0')}-31`;

      const existingMonthlyCasual = await this.leaveModel.find({
        userId: new Types.ObjectId(userId),
        leaveType: { $in: [LeaveType.CASUAL, LeaveType.HALF_DAY] },
        status: { $in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
        $or: [
          { fromDate: { $gte: monthStartStr, $lte: monthEndStr } },
          { toDate: { $gte: monthStartStr, $lte: monthEndStr } },
        ],
      });

      const alreadyUsedThisMonth = existingMonthlyCasual.reduce((acc, l) => acc + (l.paidDays || 0), 0);
      const remainingCasualQuotaThisMonth = Math.max(0, 1 - alreadyUsedThisMonth);

      if (requestedDays > remainingCasualQuotaThisMonth) {
        paidDays = Math.min(requestedDays, remainingCasualQuotaThisMonth);
        lopDays = requestedDays - paidDays;
        isLop = true;
        lopReason = alreadyUsedThisMonth >= 1
          ? 'Monthly casual leave limit (1 day/month) already used for this month. Excess converted to LOP.'
          : `Only 1 casual leave allowed per month. ${paidDays} day paid, ${lopDays} day(s) marked as Loss of Pay (LOP).`;
      }

      if (paidDays > 0 && balance.casual < paidDays) {
        paidDays = Math.max(0, balance.casual);
        lopDays = requestedDays - paidDays;
        isLop = true;
        lopReason = `Insufficient casual balance. ${paidDays} paid, ${lopDays} LOP.`;
      }
    }

    // Rule 3: Annual / Loss of pay rules
    if (dto.leaveType === LeaveType.LOSS_OF_PAY) {
      isLop = true;
      lopDays = requestedDays;
      paidDays = 0;
      lopReason = 'Direct Loss of Pay (Unpaid) application';
    }

    const leave = await this.leaveModel.create({
      userId: new Types.ObjectId(userId),
      leaveType: dto.leaveType,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      days: requestedDays,
      isHalfDay,
      halfDaySession,
      paidDays,
      lopDays,
      isLop,
      lopReason,
      reason: dto.reason,
      documentUrl: medCertUrl,
      medicalCertificateUrl: medCertUrl,
      isMedicalCertificateVerified: !!medCertUrl,
      branch: (user as any).branch || 'Chennai Main Campus',
      status: LeaveStatus.PENDING,
    });

    // Notify manager if assigned
    if (user.managerId) {
      const manager = await this.userModel.findById(user.managerId);
      if (manager) {
        await this.notificationsService.createInAppNotification(
          manager._id.toString(),
          'New Leave Application',
          `${user.name} applied for ${requestedDays} day(s) of ${dto.leaveType} leave ${isHalfDay ? `(${halfDaySession})` : ''} (${isLop ? `LOP: ${lopDays}d` : 'Paid'}).`,
          'INFO',
          '/leaves/team-requests',
        );
      }
    }

    return {
      success: true,
      message: isLop
        ? `Leave submitted. Note: ${lopReason}`
        : 'Leave application submitted successfully',
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

    if (leave.status === LeaveStatus.APPROVED) {
      await this.refundBalance(leave.userId.toString(), leave.leaveType, leave.paidDays || leave.days, leave.lopDays || 0);
    }

    leave.status = LeaveStatus.CANCELLED;
    await leave.save();

    return { success: true, message: 'Leave application cancelled', data: leave };
  }

  // 5. MANAGER / HR: TEAM LEAVE REQUESTS
  async getTeamRequests(reviewerId: string, role: Role, branch?: string) {
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
      .populate('userId', 'name employeeId email department gender branch designation dateOfJoining')
      .sort({ createdAt: -1 })
      .exec();

    let filtered = requests;
    if (branch && branch !== 'ALL') {
      filtered = requests.filter((r: any) => r.userId?.branch === branch || r.branch === branch);
    }

    return { success: true, count: filtered.length, data: filtered };
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

    if (dto.markAsLop) {
      leave.isLop = true;
      leave.lopDays = leave.days;
      leave.paidDays = 0;
      leave.lopReason = 'Marked as Loss of Pay by Reviewer';
    }

    if (dto.verifyMedicalCertificate) {
      leave.isMedicalCertificateVerified = true;
    }

    leave.status = dto.action === 'APPROVE' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    leave.reviewedBy = new Types.ObjectId(reviewerId);
    leave.reviewComments = dto.comments || '';
    leave.reviewedAt = new Date();
    await leave.save();

    // Deduct balance on approval
    if (dto.action === 'APPROVE') {
      await this.deductBalance(leave.userId.toString(), leave.leaveType, leave.paidDays || 0, leave.lopDays || 0);
    }

    // Notify employee
    const applicant = await this.userModel.findById(leave.userId);
    if (applicant) {
      await this.notificationsService.createInAppNotification(
        applicant._id.toString(),
        `Leave Request ${dto.action}`,
        `Your ${leave.leaveType} leave request from ${leave.fromDate} to ${leave.toDate} was ${dto.action.toLowerCase()}d. (${leave.isLop ? `LOP: ${leave.lopDays}d` : 'Paid'})`,
        dto.action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        '/leaves/my-history',
      );
    }

    return {
      success: true,
      message: `Leave application ${dto.action.toLowerCase()}d successfully`,
      data: leave,
    };
  }

  // 7. HR / CEO: COMPREHENSIVE LEAVE LIST API (With Branch Filter, Medical Cert preview, LOP filters)
  async getHrLeaveList(query: {
    branch?: string;
    department?: string;
    status?: string;
    leaveType?: string;
    isLop?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query.leaveType && query.leaveType !== 'ALL') {
      filter.leaveType = query.leaveType;
    }
    if (query.isLop === 'true') {
      filter.isLop = true;
    }

    const userFilter: any = { isActive: true };
    if (query.department && query.department !== 'ALL') {
      userFilter.department = query.department;
    }
    if (query.branch && query.branch !== 'ALL') {
      userFilter.branch = query.branch;
    }
    if (query.search) {
      userFilter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ];
    }

    const matchedUsers = await this.userModel.find(userFilter).select('_id');
    const matchedUserIds = matchedUsers.map((u) => u._id);
    filter.userId = { $in: matchedUserIds };

    const [leaves, total] = await Promise.all([
      this.leaveModel
        .find(filter)
        .populate('userId', 'name employeeId email department branch designation dateOfJoining')
        .populate('reviewedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.leaveModel.countDocuments(filter),
    ]);

    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: leaves,
    };
  }

  // 8. PUBLIC / TEAM LEAVE CALENDAR
  async getLeaveCalendar(month?: number, year?: number, branch?: string) {
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
      .populate('userId', 'name department employeeId branch')
      .exec();

    let filtered = leaves;
    if (branch && branch !== 'ALL') {
      filtered = leaves.filter((l: any) => l.userId?.branch === branch || l.branch === branch);
    }

    return { success: true, month: m, year: y, count: filtered.length, data: filtered };
  }

  private async deductBalance(userId: string, leaveType: LeaveType, paidDays: number, lopDays: number) {
    const balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!balance) return;

    if (leaveType === LeaveType.CASUAL || leaveType === LeaveType.HALF_DAY) balance.casual = Math.max(0, balance.casual - paidDays);
    else if (leaveType === LeaveType.SICK) balance.sick = Math.max(0, balance.sick - paidDays);
    else if (leaveType === LeaveType.ANNUAL) balance.annual = Math.max(0, balance.annual - paidDays);
    else if (leaveType === LeaveType.MATERNITY) balance.maternity = Math.max(0, balance.maternity - paidDays);
    else if (leaveType === LeaveType.PATERNITY) balance.paternity = Math.max(0, balance.paternity - paidDays);

    if (lopDays > 0) {
      balance.lossOfPay = (balance.lossOfPay || 0) + lopDays;
    }

    await balance.save();
  }

  private async refundBalance(userId: string, leaveType: LeaveType, paidDays: number, lopDays: number) {
    const balance = await this.balanceModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!balance) return;

    if (leaveType === LeaveType.CASUAL || leaveType === LeaveType.HALF_DAY) balance.casual += paidDays;
    else if (leaveType === LeaveType.SICK) balance.sick += paidDays;
    else if (leaveType === LeaveType.ANNUAL) balance.annual += paidDays;
    else if (leaveType === LeaveType.MATERNITY) balance.maternity += paidDays;
    else if (leaveType === LeaveType.PATERNITY) balance.paternity += paidDays;

    if (lopDays > 0) {
      balance.lossOfPay = Math.max(0, (balance.lossOfPay || 0) - lopDays);
    }

    await balance.save();
  }
}
