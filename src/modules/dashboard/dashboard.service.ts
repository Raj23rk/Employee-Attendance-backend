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
    private notificationsService: NotificationsService,
  ) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
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
          },
        },
      },
    };
  }

  // 2. CELEBRATIONS
  async getCelebrations() {
    const users = await this.userModel.find({ isActive: true }).select('name department avatarUrl dateOfBirth dateOfJoining').exec();
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
            avatarUrl: u.avatarUrl,
            type: 'BIRTHDAY',
            date: `${dob.getDate()} ${dob.toLocaleString('en-US', { month: 'short' })}`,
          });
        }
      }

      if (u.dateOfJoining) {
        const doj = new Date(u.dateOfJoining);
        const yearsCompleted = now.getFullYear() - doj.getFullYear();
        if (doj.getMonth() === currentMonth && yearsCompleted > 0) {
          celebrations.push({
            userId: u._id,
            name: u.name,
            department: u.department,
            avatarUrl: u.avatarUrl,
            type: 'WORK_ANNIVERSARY',
            years: yearsCompleted,
            date: `${doj.getDate()} ${doj.toLocaleString('en-US', { month: 'short' })}`,
          });
        }
      }
    }

    // Include recent wishes
    const recentWishes = await this.wishModel
      .find()
      .populate('fromUserId', 'name avatarUrl')
      .populate('targetUserId', 'name')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    return {
      success: true,
      count: celebrations.length,
      data: celebrations,
      recentWishes,
    };
  }

  // 3. SEND CELEBRATION WISH (User requirement)
  async sendWish(targetUserId: string, fromUserId: string, dto: SendCelebrationWishDto) {
    const targetUser = await this.userModel.findById(targetUserId);
    const fromUser = await this.userModel.findById(fromUserId);

    if (!targetUser || !fromUser) {
      throw new NotFoundException('User not found');
    }

    const wish = await this.wishModel.create({
      targetUserId: new Types.ObjectId(targetUserId),
      fromUserId: new Types.ObjectId(fromUserId),
      occasionType: dto.occasionType || 'GENERAL',
      message: dto.message,
      reactionEmoji: dto.reactionEmoji || '🎉',
    });

    // Notify recipient
    await this.notificationsService.createInAppNotification(
      targetUserId,
      `Celebration Wish from ${fromUser.name}`,
      `${fromUser.name} sent you a warm wish: "${dto.message}"`,
      'SUCCESS',
      '/dashboard',
    );

    await this.notificationsService.sendEmail(
      targetUser.email,
      'WISH_RECEIVED',
      {
        recipientName: targetUser.name,
        senderName: fromUser.name,
        message: dto.message,
      },
    );

    return {
      success: true,
      message: `Celebration wish sent to ${targetUser.name}`,
      data: wish,
    };
  }

  // 4. HOLIDAYS SPOTLIGHT
  async getHolidaysSpotlight() {
    const todayStr = this.getTodayString();
    let holidays = await this.holidayModel
      .find({ date: { $gte: todayStr } })
      .sort({ date: 1 })
      .limit(5)
      .exec();

    if (holidays.length === 0) {
      // Return sample upcoming holidays if empty
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

  // 5. ON LEAVE TODAY
  async getOnLeaveToday() {
    const todayStr = this.getTodayString();
    const leaves = await this.leaveModel
      .find({
        status: LeaveStatus.APPROVED,
        fromDate: { $lte: todayStr },
        toDate: { $gte: todayStr },
      })
      .populate('userId', 'name department designation avatarUrl')
      .exec();

    const members = leaves.map((l: any) => ({
      name: l.userId?.name || 'Employee',
      department: l.userId?.department || 'General',
      designation: l.userId?.designation || 'Staff',
      leaveType: l.leaveType,
    }));

    return {
      success: true,
      count: members.length,
      data: members,
    };
  }

  // 6. HOURS LOGGED CHART (7 Days)
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
