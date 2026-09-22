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
    @InjectModel(Holiday.name) private holidayModel: Model<HolidayDocument>,
    @InjectModel(AttendancePolicy.name) private policyModel: Model<AttendancePolicyDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAll();
  }

  async seedAll() {
    this.logger.log('Checking database seed state...');
    await this.seedDepartments();
    await this.seedPolicies();
    await this.seedNotificationTemplates();
    await this.seedHolidays();
    await this.seedUsers();
    this.logger.log('Database seeding process completed.');
  }

  async seedDepartments() {
    const departments = [
      { name: 'Executive & Admin', code: 'EXEC', description: 'Leadership, CEO office & Strategy' },
      { name: 'HR', code: 'HR', description: 'Human Resources, Talent Acquisition & People Ops' },
      { name: 'Technology', code: 'TECH', description: 'Software Engineering, Cloud & Platforms' },
      { name: 'Skill Campus', code: 'SKILL', description: 'Technical & Vocational Student Programs' },
      { name: 'B School', code: 'BSCH', description: 'Management Education & Placement' },
    ];

    for (const d of departments) {
      await this.deptModel.updateOne({ name: d.name }, { $set: d }, { upsert: true });
    }
    this.logger.log('Seeded initial departments');
  }

  async seedPolicies() {
    const policy = await this.policyModel.findOne({ isActive: true });
    if (!policy) {
      await this.policyModel.create({
        policyName: 'Standard Campus Shift Policy',
        workStartTime: '09:00',
        workEndTime: '18:00',
        gracePeriodMinutes: 15,
        halfDayThresholdMinutes: 240,
        fullDayThresholdMinutes: 480,
        defaultBreakMinutes: 60,
        isActive: true,
      });
      this.logger.log('Seeded standard attendance policy');
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
    this.logger.log('Seeded database notification templates');
  }

  async seedHolidays() {
    const count = await this.holidayModel.countDocuments();
    if (count > 0) return;

    await this.holidayModel.insertMany([
      { title: 'Gandhi Jayanti', date: '2026-10-02', type: 'National', description: 'National Holiday' },
      { title: 'Diwali (Deepavali)', date: '2026-11-08', type: 'Festival', description: 'Festival of Lights' },
      { title: 'Christmas Day', date: '2026-12-25', type: 'Festival', description: 'Christmas' },
      { title: 'New Year Day', date: '2027-01-01', type: 'Holiday', description: 'New Year Celebration' },
      { title: 'Republic Day', date: '2027-01-26', type: 'National', description: 'Republic Day Parade' },
    ]);
    this.logger.log('Seeded company holidays');
  }

  async seedUsers() {
    const ceoEmail = 'ceo@wegrow.edu.in';
    let ceo = await this.userModel.findOne({ email: ceoEmail });

    const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

    if (!ceo) {
      ceo = await this.userModel.create({
        employeeId: 'WG-CEO-001',
        name: 'Raj CEO',
        email: ceoEmail,
        password: defaultPasswordHash,
        role: Role.CEO,
        gender: Gender.MALE,
        department: 'Executive & Admin',
        designation: 'Chief Executive Officer',
        phone: '+91 9876543210',
        dateOfJoining: new Date('2022-01-01'),
        dateOfBirth: new Date('1985-09-15'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: ceo._id,
        year: 2026,
        annual: 20,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3,
      });
      this.logger.log(`Created CEO user: ${ceoEmail} (Password@123)`);
    }

    // Clean up any non-@wegrow.edu.in accounts
    await this.userModel.deleteMany({ email: { $not: /@wegrow\.edu\.in$/i } });

    // Rajkumar CEO: rajkumar@wegrow.edu.in
    const myEmail = 'rajkumar@wegrow.edu.in';
    let myUser = await this.userModel.findOne({ email: myEmail });
    if (!myUser) {
      myUser = await this.userModel.create({
        employeeId: 'WG-CEO-000',
        name: 'Rajkumar',
        email: myEmail,
        password: defaultPasswordHash,
        role: Role.CEO,
        gender: Gender.MALE,
        department: 'Executive & Admin',
        designation: 'Managing Director & CEO',
        phone: '+91 9876543210',
        dateOfJoining: new Date('2022-01-01'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: myUser._id,
        year: 2026,
        annual: 25,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3,
      });
      this.logger.log(`Created User account: ${myEmail} (Password@123)`);
    }

    // HR User
    const hrEmail = 'hr@wegrow.edu.in';
    let hr = await this.userModel.findOne({ email: hrEmail });
    if (!hr) {
      hr = await this.userModel.create({
        employeeId: 'WG-HR-002',
        name: 'Ananya HR',
        email: hrEmail,
        password: defaultPasswordHash,
        role: Role.HR,
        gender: Gender.FEMALE,
        department: 'HR',
        designation: 'Head of Human Resources',
        managerId: ceo._id,
        phone: '+91 9876543211',
        dateOfJoining: new Date('2023-03-01'),
        dateOfBirth: new Date('1990-09-28'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: hr._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 182,
        paternity: 0,
      });
      this.logger.log(`Created HR user: ${hrEmail} (Password@123)`);
    }

    // Admin User
    const adminEmail = 'admin@wegrow.edu.in';
    let admin = await this.userModel.findOne({ email: adminEmail });
    if (!admin) {
      admin = await this.userModel.create({
        employeeId: 'WG-ADM-001',
        name: 'System Admin',
        email: adminEmail,
        password: defaultPasswordHash,
        role: Role.ADMIN,
        gender: Gender.MALE,
        department: 'Executive & Admin',
        designation: 'System Administrator',
        managerId: ceo._id,
        phone: '+91 9876543200',
        dateOfJoining: new Date('2023-01-01'),
        dateOfBirth: new Date('1991-05-12'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: admin._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3,
      });
      this.logger.log(`Created Admin user: ${adminEmail} (Password@123)`);
    }

    // Manager User
    const mgrEmail = 'manager@wegrow.edu.in';
    let manager = await this.userModel.findOne({ email: mgrEmail });
    if (!manager) {
      manager = await this.userModel.create({
        employeeId: 'WG-MGR-003',
        name: 'Vikram Lead',
        email: mgrEmail,
        password: defaultPasswordHash,
        role: Role.MANAGER,
        gender: Gender.MALE,
        department: 'Technology',
        designation: 'Engineering Manager',
        managerId: ceo._id,
        phone: '+91 9876543212',
        dateOfJoining: new Date('2023-06-01'),
        dateOfBirth: new Date('1988-10-10'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: manager._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3,
      });
      this.logger.log(`Created Manager user: ${mgrEmail} (Password@123)`);
    }

    // Female Employee: Priya Sharma (Eligible for Maternity leave)
    const priyaEmail = 'priya.sharma@wegrow.edu.in';
    let priya = await this.userModel.findOne({ email: priyaEmail });
    if (!priya) {
      priya = await this.userModel.create({
        employeeId: 'WG-EMP-014',
        name: 'Priya Sharma',
        email: priyaEmail,
        password: defaultPasswordHash,
        role: Role.EMPLOYEE,
        gender: Gender.FEMALE,
        department: 'Technology',
        designation: 'Frontend Engineer',
        managerId: manager._id,
        phone: '+91 9876543214',
        dateOfJoining: new Date('2024-02-15'),
        dateOfBirth: new Date('1996-09-14'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: priya._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 182, // 26 weeks statutory maternity leave for women
        paternity: 0,
      });
      await this.seedDemoAttendance(priya._id);
      this.logger.log(`Created Female Employee: ${priyaEmail} (Password@123, Maternity Eligible)`);
    }

    // Male Employee: Vijay Kumaran (Eligible for 3-Day Paid Paternity leave)
    const vijayEmail = 'vijay.kumaran@wegrow.edu.in';
    let vijay = await this.userModel.findOne({ email: vijayEmail });
    if (!vijay) {
      vijay = await this.userModel.create({
        employeeId: 'WG-EMP-015',
        name: 'Vijay Kumaran',
        email: vijayEmail,
        password: defaultPasswordHash,
        role: Role.EMPLOYEE,
        gender: Gender.MALE,
        department: 'Technology',
        designation: 'Software Engineer',
        managerId: manager._id,
        phone: '+91 9876543215',
        dateOfJoining: new Date('2024-03-01'),
        dateOfBirth: new Date('1997-09-08'),
        isActive: true,
      });
      await this.balanceModel.create({
        userId: vijay._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3, // 3-day paid paternity leave for men
      });
      await this.seedDemoAttendance(vijay._id);
      this.logger.log(`Created Male Employee: ${vijayEmail} (Password@123, 3-Day Paid Paternity Eligible)`);
    }
  }

  async seedDemoAttendance(userId: any) {
    const targetMonth = 9; // September
    const targetYear = 2026;

    const sampleDays = [
      { day: 1, status: AttendanceStatus.PRESENT, in: '09:05:00', out: '18:15:00', min: 490 },
      { day: 2, status: AttendanceStatus.PRESENT, in: '09:00:00', out: '18:00:00', min: 480 },
      { day: 3, status: AttendanceStatus.PRESENT, in: '08:55:00', out: '18:10:00', min: 495 },
      { day: 4, status: AttendanceStatus.LEAVE, in: null, out: null, min: 0 },
      { day: 7, status: AttendanceStatus.PRESENT, in: '09:12:00', out: '18:30:00', min: 498 },
      { day: 8, status: AttendanceStatus.PRESENT, in: '09:15:00', out: '18:15:00', min: 480 },
      { day: 9, status: AttendanceStatus.PRESENT, in: '09:00:00', out: '18:00:00', min: 480 },
      { day: 10, status: AttendanceStatus.WFH, in: '09:30:00', out: '18:30:00', min: 480 },
      { day: 11, status: AttendanceStatus.PRESENT, in: '09:05:00', out: '18:05:00', min: 480 },
    ];

    for (const s of sampleDays) {
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
      const existing = await this.attendanceModel.findOne({ userId, date: dateStr });
      if (!existing) {
        await this.attendanceModel.create({
          userId,
          date: dateStr,
          status: s.status,
          source: AttendanceSource.WEB,
          checkInTime: s.in ? new Date(`${dateStr}T${s.in}.000Z`) : null,
          checkOutTime: s.out ? new Date(`${dateStr}T${s.out}.000Z`) : null,
          totalWorkingMinutes: s.min,
          breakMinutes: 60,
        });
      }
    }
  }
}
