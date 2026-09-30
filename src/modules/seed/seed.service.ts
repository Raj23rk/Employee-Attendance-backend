import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LeaveBalance, LeaveBalanceDocument } from '../leaves/schemas/leave-balance.schema';
import {
  NotificationTemplate,
  NotificationTemplateDocument,
} from '../notifications/schemas/notification-template.schema';
import { Department, DepartmentDocument } from '../organization/schemas/department.schema';
import { Branch, BranchDocument } from '../organization/schemas/branch.schema';
import { Holiday, HolidayDocument } from '../dashboard/schemas/holiday.schema';
import {
  AttendancePolicy,
  AttendancePolicyDocument,
} from '../attendance/schemas/attendance-policy.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Role } from '../../common/enums/role.enum';
import { Gender } from '../../common/enums/gender.enum';
import { AttendanceStatus, AttendanceSource } from '../../common/enums/attendance-status.enum';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LeaveBalance.name) private balanceModel: Model<LeaveBalanceDocument>,
    @InjectModel(NotificationTemplate.name)
    private templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Holiday.name) private holidayModel: Model<HolidayDocument>,
    @InjectModel(AttendancePolicy.name) private policyModel: Model<AttendancePolicyDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAll();
  }

  async seedAll() {
    this.logger.log('Checking system configuration...');
    await this.seedPolicies();
    await this.seedNotificationTemplates();
    this.logger.log('System configuration ready. No static demo data seeded.');
  }

  async seedPolicies() {
    const existing = await this.policyModel.findOne({ isActive: true });
    if (!existing) {
      await this.policyModel.create({
        policyName: 'Standard Campus Shift Policy',
        workStartTime: '09:40',
        graceTime: '09:45',
        workEndTime: '19:00',
        gracePeriodMinutes: 5,
        allowedLateCheckins: 3,
        maxMonthlyPermissionHours: 2,
        halfDayThresholdMinutes: 270,
        fullDayThresholdMinutes: 500,
        defaultBreakMinutes: 60,
        isActive: true,
      });
      this.logger.log('Initialized standard shift policy: 09:40 Check-in, 09:45 Grace, 19:00 Check-out');
    }
  }

  async seedNotificationTemplates() {
    const templates = [
      {
        code: 'PASSWORD_RESET',
        title: 'Password Reset Request',
        subject: 'Reset your password for Wegrow Employee Portal',
        bodyHtml: '<h3>Hello {{name}},</h3><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{link}}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>',
        variables: ['name', 'link', 'token'],
      },
      {
        code: 'LEAVE_SUBMITTED',
        title: 'Leave Application Received',
        subject: 'New Leave Application from {{employeeName}}',
        bodyHtml: '<h3>Hi {{managerName}},</h3><p>{{employeeName}} has applied for <strong>{{days}} days</strong> of <strong>{{leaveType}}</strong> leave from {{fromDate}} to {{toDate}}.</p><p>Reason: {{reason}}</p>',
        variables: ['managerName', 'employeeName', 'days', 'leaveType', 'fromDate', 'toDate', 'reason'],
      },
      {
        code: 'LEAVE_STATUS_CHANGED',
        title: 'Leave Application Status Update',
        subject: 'Your {{leaveType}} Leave Request has been {{status}}',
        bodyHtml: '<h3>Dear {{name}},</h3><p>Your <strong>{{leaveType}}</strong> leave application has been <strong>{{status}}</strong>.</p><p>Remarks: {{comments}}</p>',
        variables: ['name', 'leaveType', 'status', 'comments'],
      },
      {
        code: 'ATTENDANCE_CORRECTION_REVIEWED',
        title: 'Attendance Correction Reviewed',
        subject: 'Attendance Correction for {{date}} has been {{status}}',
        bodyHtml: '<h3>Dear {{name}},</h3><p>Your attendance correction request for date <strong>{{date}}</strong> has been <strong>{{status}}</strong>.</p><p>Remarks: {{remarks}}</p>',
        variables: ['name', 'date', 'status', 'remarks'],
      },
      {
        code: 'WISH_RECEIVED',
        title: 'Celebration Wish Received',
        subject: 'Warm Celebration Wish from {{senderName}} 🎉',
        bodyHtml: '<h3>Dear {{recipientName}},</h3><p>{{senderName}} sent you a celebratory wish:</p><blockquote style="font-size: 16px; color: #2563eb;">{{message}}</blockquote>',
        variables: ['recipientName', 'senderName', 'message'],
      },
    ];

    for (const t of templates) {
      await this.templateModel.updateOne(
        { code: t.code },
        { $set: t },
        { upsert: true },
      );
    }
  }
}
