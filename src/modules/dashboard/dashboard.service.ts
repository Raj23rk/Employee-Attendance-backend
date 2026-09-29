import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveDocument } from '../leaves/schemas/leave.schema';
import { LeaveBalance, LeaveBalanceDocument } from '../leaves/schemas/leave-balance.schema';
import {
  CelebrationWish,
  CelebrationWishDocument,
} from './schemas/celebration-wish.schema';
import { Holiday, HolidayDocument } from './schemas/holiday.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { Permission, PermissionDocument } from '../attendance/schemas/permission.schema';
import { Branch, BranchDocument } from '../organization/schemas/branch.schema';
import { SendCelebrationWishDto } from './dto/wish.dto';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { LeaveStatus } from '../../common/enums/leave-type.enum';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Leave.name) private leaveModel: Model<LeaveDocument>,
    @InjectModel(LeaveBalance.name) private balanceModel: Model<LeaveBalanceDocument>,
    @InjectModel(CelebrationWish.name) private wishModel: Model<CelebrationWishDocument>,
    @InjectModel(Holiday.name) private holidayModel: Model<HolidayDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Permission.name) private permissionModel: Model<PermissionDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatTime(date: Date | null | undefined): string | null {
    if (!date) return null;
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // 1. OVERVIEW
  async getOverview(userId: string, role: Role) {
    const todayStr = this.getTodayString();

    const [todayAttendance, pendingTasks, balance, pendingLeavesCount] = await Promise.all([
      this.attendanceModel.findOne({ userId: new Types.ObjectId(userId), date: todayStr }),
      this.taskModel.countDocuments({ assigneeId: new Types.ObjectId(userId), status: { $ne: 'COMPLETED' } }),
      this.balanceModel.findOne({ userId: new Types.ObjectId(userId) }),
      this.leaveModel.countDocuments({ userId: new Types.ObjectId(userId), status: LeaveStatus.PENDING }),
    ]);

    let workingHours = '00:00';
    if (todayAttendance && todayAttendance.checkInTime) {
      const endTime = todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime) : new Date();
      const diffMs = endTime.getTime() - new Date(todayAttendance.checkInTime).getTime();
      const totalMinutes = Math.max(0, Math.floor(diffMs / 60000) - (todayAttendance.breakMinutes || 60));
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      workingHours = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    return {
      success: true,
      data: {
        todayCheckIn: {
          checkedIn: !!todayAttendance?.checkInTime,
          checkInTime: todayAttendance?.checkInTime || null,
          checkOutTime: todayAttendance?.checkOutTime || null,
          status: todayAttendance?.status || AttendanceStatus.ABSENT,
          workingHours,
        },
        kpis: {
          pendingTasks,
          pendingLeaves: pendingLeavesCount,
          leaveBalances: {
            casual: balance?.casual || 12,
            sick: balance?.sick || 10,
            annual: balance?.annual || 15,
            maternity: balance?.maternity || 0,
            paternity: balance?.paternity || 0,
            lossOfPay: balance?.lossOfPay || 0,
          },
        },
      },
    };
  }

  // 2. HR & CEO: EMPLOYEE DETAILS DASHBOARD (Table: ID, Name, Date of Joining, Branch, Checkin, Checkout, Action Popup Data)
  async getHrCeoEmployeeDashboard(query: {
    branch?: string;
    department?: string;
    status?: string;
    search?: string;
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const dateStr = query.date || this.getTodayString();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const userFilter: any = {};
    if (query.department && query.department !== 'ALL') {
      userFilter.department = query.department;
    }
    if (query.branch && query.branch !== 'ALL') {
      userFilter.branch = query.branch;
    }
    if (query.status === 'ACTIVE') {
      userFilter.isActive = true;
    } else if (query.status === 'INACTIVE') {
      userFilter.isActive = false;
    }
    if (query.search) {
      userFilter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { designation: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(userFilter)
        .populate('managerId', 'name employeeId')
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 })
        .exec(),
      this.userModel.countDocuments(userFilter),
    ]);

    const userIds = users.map((u) => u._id);

    // Fetch today's attendance for these users
    const attendances = await this.attendanceModel.find({
      userId: { $in: userIds },
      date: dateStr,
    });
    const attMap = new Map<string, AttendanceDocument>();
    attendances.forEach((a) => attMap.set(a.userId.toString(), a));

    // Fetch leave balances for these users
    const balances = await this.balanceModel.find({
      userId: { $in: userIds },
    });
    const balanceMap = new Map<string, LeaveBalanceDocument>();
    balances.forEach((b) => balanceMap.set(b.userId.toString(), b));

    // Aggregate monthly statistics
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const monthlyAttendances = await this.attendanceModel.find({
      userId: { $in: userIds },
      date: { $gte: startStr, $lte: endStr },
    });

    const monthlyPermissions = await this.permissionModel.find({
      userId: { $in: userIds },
      date: { $gte: startStr, $lte: endStr },
    });

    const rows = users.map((u) => {
      const att = attMap.get(u._id.toString());
      const bal = balanceMap.get(u._id.toString());
      const userAtts = monthlyAttendances.filter((a) => a.userId.toString() === u._id.toString());
      const userPerms = monthlyPermissions.filter((p) => p.userId.toString() === u._id.toString());

      const lateDays = userAtts.filter((a) => a.isLate).length;
      const latePenaltyHalfDays = userAtts.filter((a) => a.isLatePenaltyApplied).length;
      const presentDays = userAtts.filter((a) => a.status === AttendanceStatus.PRESENT).length;
      const halfDays = userAtts.filter((a) => a.status === AttendanceStatus.HALF_DAY).length;
      const permissionHours = userPerms.reduce((acc, p) => acc + p.durationHours, 0);

      const checkInFormatted = att && att.checkInTime ? this.formatTime(att.checkInTime) : null;
      const checkOutFormatted = att && att.checkOutTime ? this.formatTime(att.checkOutTime) : null;

      return {
        id: u.employeeId,
        _id: u._id,
        employeeId: u.employeeId,
        name: u.name,
        email: u.email,
        phone: u.phone || '-',
        gender: u.gender,
        dateOfJoining: u.dateOfJoining ? new Date(u.dateOfJoining).toISOString().split('T')[0] : 'N/A',
        branch: (u as any).branch || 'Chennai Main Campus',
        department: u.department,
        designation: u.designation,
        isActive: u.isActive,
        // Attendance Data
        checkin: checkInFormatted || '-',
        checkout: checkOutFormatted || '-',
        todayStatus: att ? att.status : AttendanceStatus.ABSENT,
        isLate: att?.isLate || false,
        lateMinutes: att?.lateMinutes || 0,
        isLatePenaltyApplied: att?.isLatePenaltyApplied || false,
        locationAddress: att?.locationAddress || att?.checkInLocation?.address || '',
        // Full Bank Account Details for Popup
        bankDetails: {
          accountName: u.bankDetails?.accountName || u.name,
          accountNumber: u.bankDetails?.accountNumber || 'Not provided',
          bankName: u.bankDetails?.bankName || 'Not provided',
          ifscCode: u.bankDetails?.ifscCode || 'Not provided',
        },
        emergencyContact: u.emergencyContact || {},
        leaveBalances: {
          casual: bal?.casual || 12,
          sick: bal?.sick || 10,
          annual: bal?.annual || 15,
          maternity: bal?.maternity || 0,
          paternity: bal?.paternity || 0,
          lossOfPay: bal?.lossOfPay || 0,
        },
        monthlyMetrics: {
          presentDays,
          lateDays,
          latePenaltyHalfDays,
          halfDays,
          permissionHoursUsed: permissionHours,
        },
      };
    });

    // Summary KPIs
    const branches = await this.branchModel.find({ isActive: true }).exec();
    const branchList = branches.map((b) => b.name);

    return {
      success: true,
      date: dateStr,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      availableBranches: branchList.length > 0 ? branchList : ['Chennai Main Campus', 'Bangalore Tech Hub', 'Hyderabad Branch'],
      data: rows,
    };
  }

  // 3. FULL EMPLOYEE DETAILS POPUP API
  async getEmployeeFullDetailsPopup(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('managerId', 'name employeeId email designation')
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    const todayStr = this.getTodayString();
    const [todayAtt, balance, recentLeaves, recentPermissions] = await Promise.all([
      this.attendanceModel.findOne({ userId: new Types.ObjectId(userId), date: todayStr }),
      this.balanceModel.findOne({ userId: new Types.ObjectId(userId) }),
      this.leaveModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(10),
      this.permissionModel.find({ userId: new Types.ObjectId(userId) }).sort({ date: -1 }).limit(10),
    ]);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const monthlyAttendances = await this.attendanceModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: startStr, $lte: endStr },
    });

    const lateCount = monthlyAttendances.filter((a) => a.isLate).length;
    const latePenaltyHalfDays = monthlyAttendances.filter((a) => a.isLatePenaltyApplied).length;
    const presentCount = monthlyAttendances.filter((a) => a.status === AttendanceStatus.PRESENT).length;
    const totalWorkingMinutes = monthlyAttendances.reduce((acc, a) => acc + (a.totalWorkingMinutes || 0), 0);

    return {
      success: true,
      employee: {
        id: user.employeeId,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || 'N/A',
        personalEmail: user.personalEmail || 'N/A',
        address: user.address || 'N/A',
        gender: user.gender,
        role: user.role,
        department: user.department,
        designation: user.designation,
        branch: (user as any).branch || 'Chennai Main Campus',
        dateOfJoining: user.dateOfJoining ? new Date(user.dateOfJoining).toISOString().split('T')[0] : 'N/A',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : 'N/A',
        isActive: user.isActive,
        manager: user.managerId,
        avatarUrl: user.avatarUrl,
        bankAccountDetails: {
          accountName: user.bankDetails?.accountName || user.name,
          accountNumber: user.bankDetails?.accountNumber || 'Not provided',
          bankName: user.bankDetails?.bankName || 'Not provided',
          ifscCode: user.bankDetails?.ifscCode || 'Not provided',
        },
        emergencyContact: user.emergencyContact || {},
      },
      todayAttendance: {
        date: todayStr,
        checkIn: todayAtt && todayAtt.checkInTime ? this.formatTime(todayAtt.checkInTime) : null,
        checkOut: todayAtt && todayAtt.checkOutTime ? this.formatTime(todayAtt.checkOutTime) : null,
        status: todayAtt ? todayAtt.status : AttendanceStatus.ABSENT,
        isLate: todayAtt?.isLate || false,
        lateMinutes: todayAtt?.lateMinutes || 0,
        isLatePenaltyApplied: todayAtt?.isLatePenaltyApplied || false,
        checkInLocation: todayAtt?.checkInLocation || null,
        checkOutLocation: todayAtt?.checkOutLocation || null,
      },
      monthlySummary: {
        month: currentMonth,
        year: currentYear,
        presentDays: presentCount,
        lateDays: lateCount,
        latePenaltyHalfDays,
        allowedLateLimit: 3,
        totalWorkingHours: `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`,
      },
      leaveBalances: {
        casual: balance?.casual || 12,
        sick: balance?.sick || 10,
        annual: balance?.annual || 15,
        maternity: balance?.maternity || 0,
        paternity: balance?.paternity || 0,
        lossOfPay: balance?.lossOfPay || 0,
      },
      recentLeaves,
      recentPermissions,
    };
  }

  // 4. INDIVIDUAL EMPLOYEE REPORT DOWNLOAD (CSV / Summary)
  async downloadIndividualEmployeeReport(userId: string, month?: number, year?: number): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    const targetDate = new Date();
    const y = year || targetDate.getFullYear();
    const m = month || targetDate.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const attendances = await this.attendanceModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startStr, $lte: endStr },
      })
      .sort({ date: 1 })
      .exec();

    const permissions = await this.permissionModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: startStr, $lte: endStr },
    });

    const doj = user.dateOfJoining ? new Date(user.dateOfJoining).toISOString().split('T')[0] : 'N/A';

    let csv = `EMPLOYEE ATTENDANCE & PAYROLL STATEMENT\n`;
    csv += `Employee ID: ${user.employeeId}\n`;
    csv += `Name: ${user.name}\n`;
    csv += `Branch: ${(user as any).branch || 'Chennai Main Campus'}\n`;
    csv += `Department: ${user.department}\n`;
    csv += `Designation: ${user.designation}\n`;
    csv += `Date of Joining: ${doj}\n`;
    csv += `Bank Name: ${user.bankDetails?.bankName || 'N/A'}, Account Number: ${user.bankDetails?.accountNumber || 'N/A'}, IFSC: ${user.bankDetails?.ifscCode || 'N/A'}\n`;
    csv += `Report Month/Year: ${m}/${y}\n\n`;

    csv += `Date,Status,Check In,Check Out,Working Hours,Is Late,Late Minutes,Late Penalty,Location / Branch,Notes\n`;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(y, m - 1, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      const record = attendances.find((a) => a.date === dateStr);
      const status = record ? record.status : isWeekend ? 'WEEK_OFF' : 'ABSENT';
      const checkIn = record && record.checkInTime ? this.formatTime(record.checkInTime) : '-';
      const checkOut = record && record.checkOutTime ? this.formatTime(record.checkOutTime) : '-';
      const workingHours = record ? `${Math.floor(record.totalWorkingMinutes / 60)}h ${record.totalWorkingMinutes % 60}m` : '0h 0m';
      const isLateStr = record?.isLate ? 'YES' : 'NO';
      const lateMins = record?.lateMinutes || 0;
      const penalty = record?.isLatePenaltyApplied ? 'HALF_DAY_DEDUCTION' : 'NONE';
      const location = record?.locationAddress || (user as any).branch || 'Chennai Main Campus';
      const notes = record?.notes ? `"${record.notes.replace(/"/g, '""')}"` : '';

      csv += `"${dateStr}","${status}","${checkIn}","${checkOut}","${workingHours}","${isLateStr}",${lateMins},"${penalty}","${location}",${notes}\n`;
    }

    const totalLate = attendances.filter((a) => a.isLate).length;
    const totalHalfDayDeductions = attendances.filter((a) => a.isLatePenaltyApplied).length;
    const totalPermissionHours = permissions.reduce((acc, p) => acc + p.durationHours, 0);

    csv += `\nSUMMARY METRICS\n`;
    csv += `Total Late Check-ins (Shift 9:40 AM): ${totalLate}\n`;
    csv += `Late Check-ins Exceeded Grace (>3): ${totalHalfDayDeductions} Half-day salary deductions\n`;
    csv += `Total Monthly Permissions (Limit 2 hrs): ${totalPermissionHours} hrs\n`;

    return csv;
  }

  // 5. CELEBRATIONS
  async getCelebrations() {
    const users = await this.userModel.find({ isActive: true }).select('name department branch avatarUrl dateOfBirth dateOfJoining').exec();
    const now = new Date();
    const currentMonth = now.getMonth();

    const celebrations = [];

    for (const u of users) {
      if (u.dateOfBirth) {
        const dob = new Date(u.dateOfBirth);
        if (dob.getMonth() === currentMonth) {
          celebrations.push({
            userId: u._id,
            name: u.name,
            department: u.department,
            branch: (u as any).branch || 'Chennai Main Campus',
            avatarUrl: u.avatarUrl,
            type: 'BIRTHDAY',
            date: dob.getDate(),
          });
        }
      }

      if (u.dateOfJoining) {
        const doj = new Date(u.dateOfJoining);
        if (doj.getMonth() === currentMonth && doj.getFullYear() < now.getFullYear()) {
          const years = now.getFullYear() - doj.getFullYear();
          celebrations.push({
            userId: u._id,
            name: u.name,
            department: u.department,
            branch: (u as any).branch || 'Chennai Main Campus',
            avatarUrl: u.avatarUrl,
            type: 'WORK_ANNIVERSARY',
            years,
            date: doj.getDate(),
          });
        }
      }
    }

    return { success: true, count: celebrations.length, data: celebrations };
  }

  // 6. SEND CELEBRATION WISH
  async sendWish(targetUserId: string, fromUserId: string, dto: SendCelebrationWishDto) {
    return this.sendCelebrationWish(fromUserId, targetUserId, dto);
  }

  async sendCelebrationWish(fromUserId: string, targetUserId: string, dto: SendCelebrationWishDto) {
    const fromUser = await this.userModel.findById(fromUserId);

    const targetUser = await this.userModel.findById(targetUserId);

    if (!fromUser || !targetUser) {
      throw new NotFoundException('User not found');
    }

    const wish = await this.wishModel.create({
      targetUserId: new Types.ObjectId(targetUserId),
      fromUserId: new Types.ObjectId(fromUserId),
      occasionType: dto.occasionType || 'GENERAL',
      message: dto.message,
      reactionEmoji: dto.reactionEmoji || '🎉',
    });

    await this.notificationsService.createInAppNotification(
      targetUserId,
      `Celebration Wish from ${fromUser.name}`,
      `${fromUser.name} sent you a warm wish: "${dto.message}"`,
      'SUCCESS',
      '/dashboard',
    );

    return {
      success: true,
      message: `Celebration wish sent to ${targetUser.name}`,
      data: wish,
    };
  }

  // 7. HOLIDAYS SPOTLIGHT
  async getHolidaysSpotlight() {
    const todayStr = this.getTodayString();
    let holidays = await this.holidayModel
      .find({ date: { $gte: todayStr } })
      .sort({ date: 1 })
      .limit(5)
      .exec();

    if (holidays.length === 0) {
      holidays = [
        {
          title: 'Gandhi Jayanti',
          date: '2026-10-02',
          type: 'National',
          description: 'Birth anniversary of Mahatma Gandhi',
        } as any,
        {
          title: 'Diwali (Deepavali)',
          date: '2026-11-08',
          type: 'Festival',
          description: 'Festival of Lights',
        } as any,
      ];
    }

    const withCountdown = holidays.map((h) => {
      const diffTime = new Date(h.date).getTime() - new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return {
        title: h.title,
        date: h.date,
        type: h.type,
        daysRemaining,
      };
    });

    return { success: true, data: withCountdown };
  }

  // 8. ON LEAVE TODAY
  async getOnLeaveToday(branch?: string) {
    const todayStr = this.getTodayString();
    const leaves = await this.leaveModel
      .find({
        status: LeaveStatus.APPROVED,
        fromDate: { $lte: todayStr },
        toDate: { $gte: todayStr },
      })
      .populate('userId', 'name department designation branch avatarUrl')
      .exec();

    let members = leaves.map((l: any) => ({
      name: l.userId?.name || 'Employee',
      department: l.userId?.department || 'General',
      designation: l.userId?.designation || 'Staff',
      branch: l.userId?.branch || l.branch || 'Chennai Main Campus',
      leaveType: l.leaveType,
    }));

    if (branch && branch !== 'ALL') {
      members = members.filter((m) => m.branch === branch);
    }

    return {
      success: true,
      count: members.length,
      data: members,
    };
  }

  // 9. HOURS LOGGED CHART
  async getHoursLoggedChart(userId: string) {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const record = await this.attendanceModel.findOne({
        userId: new Types.ObjectId(userId),
        date: dateStr,
      });

      const hours = record ? Number((record.totalWorkingMinutes / 60).toFixed(1)) : 0;

      days.push({
        date: dateStr,
        day: dayName,
        hours,
        status: record ? record.status : (d.getDay() === 0 || d.getDay() === 6 ? 'WEEK_OFF' : 'ABSENT'),
      });
    }

    return { success: true, data: days };
  }
}
