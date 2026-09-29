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
    this.logger.log('Checking database seed state...');
    await this.seedBranches();
    await this.seedDepartments();
    await this.seedPolicies();
    await this.seedNotificationTemplates();
    await this.seedHolidays();
    await this.seedUsers();
    this.logger.log('Database seeding process completed.');
  }

  async seedBranches() {
    const branches = [
      {
        name: 'Chennai Main Campus',
        code: 'CHN-01',
        address: 'Block A, Wegrow Knowledge Park, OMR',
        city: 'Chennai',
        state: 'Tamil Nadu',
        latitude: 12.9716,
        longitude: 80.2436,
        radiusMeters: 500,
        contactEmail: 'chennai.office@wegrow.edu.in',
        contactPhone: '+91 44 2847 1100',
        isActive: true,
      },
      {
        name: 'Bangalore Tech Hub',
        code: 'BLR-02',
        address: '4th Floor, Tech Innovation Center, Whitefield',
        city: 'Bangalore',
        state: 'Karnataka',
        latitude: 12.9698,
        longitude: 77.7499,
        radiusMeters: 500,
        contactEmail: 'bangalore.hub@wegrow.edu.in',
        contactPhone: '+91 80 4123 9900',
        isActive: true,
      },
      {
        name: 'Hyderabad Branch',
        code: 'HYD-03',
        address: 'Survey No. 64, HITEC City, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        latitude: 17.4483,
        longitude: 78.3915,
        radiusMeters: 500,
        contactEmail: 'hyderabad.branch@wegrow.edu.in',
        contactPhone: '+91 40 6789 2200',
        isActive: true,
      },
    ];

    for (const b of branches) {
      await this.branchModel.updateOne({ code: b.code }, { $set: b }, { upsert: true });
    }
    this.logger.log('Seeded initial 3 company branches');
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
    await this.policyModel.updateOne(
      { isActive: true },
      {
        $set: {
          policyName: 'Standard Campus Shift Policy',
          workStartTime: '09:40', // 9:40 AM Check-in
          graceTime: '09:45', // 9:45 AM Grace time
          workEndTime: '19:00', // 7:00 PM Check-out
          gracePeriodMinutes: 5,
          allowedLateCheckins: 3, // 3 grace check-ins allowed per month
          maxMonthlyPermissionHours: 2, // 2 hours permission allowed per month
          halfDayThresholdMinutes: 270,
          fullDayThresholdMinutes: 500,
          defaultBreakMinutes: 60,
          isActive: true,
        },
      },
      { upsert: true },
    );
    this.logger.log('Seeded standard shift policy: 09:40 Check-in, 09:45 Grace, 19:00 Check-out');
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
    const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

    // Rajkumar CEO
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
        branch: 'Chennai Main Campus',
        designation: 'Managing Director & CEO',
        phone: '+91 9876543210',
        dateOfJoining: new Date('2022-01-01'),
        dateOfBirth: new Date('1985-09-15'),
        bankDetails: {
          accountName: 'Rajkumar',
          accountNumber: '918273645012',
          bankName: 'HDFC Bank',
          ifscCode: 'HDFC0001234',
        },
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
    }

    // CEO account
    const ceoEmail = 'ceo@wegrow.edu.in';
    let ceo = await this.userModel.findOne({ email: ceoEmail });
    if (!ceo) {
      ceo = await this.userModel.create({
        employeeId: 'WG-CEO-001',
        name: 'Raj CEO',
        email: ceoEmail,
        password: defaultPasswordHash,
        role: Role.CEO,
        gender: Gender.MALE,
        department: 'Executive & Admin',
        branch: 'Chennai Main Campus',
        designation: 'Chief Executive Officer',
        phone: '+91 9876543210',
        dateOfJoining: new Date('2022-01-01'),
        dateOfBirth: new Date('1985-09-15'),
        bankDetails: {
          accountName: 'Raj CEO',
          accountNumber: '918273645013',
          bankName: 'ICICI Bank',
          ifscCode: 'ICIC0005678',
        },
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
        branch: 'Chennai Main Campus',
        designation: 'Head of Human Resources',
        managerId: myUser?._id || ceo._id,
        phone: '+91 9876543211',
        dateOfJoining: new Date('2023-03-01'),
        dateOfBirth: new Date('1990-09-28'),
        bankDetails: {
          accountName: 'Ananya HR',
          accountNumber: '445566778899',
          bankName: 'State Bank of India',
          ifscCode: 'SBIN0004321',
        },
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
    }

    // Manager User (Bangalore Tech Hub)
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
        branch: 'Bangalore Tech Hub',
        designation: 'Engineering Manager',
        managerId: myUser?._id || ceo._id,
        phone: '+91 9876543212',
        dateOfJoining: new Date('2023-06-01'),
        dateOfBirth: new Date('1988-10-10'),
        bankDetails: {
          accountName: 'Vikram Lead',
          accountNumber: '556677889900',
          bankName: 'Axis Bank',
          ifscCode: 'UTIB0001122',
        },
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
    }

    // Female Employee: Priya Sharma (Hyderabad Branch, Maternity eligible)
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
        branch: 'Hyderabad Branch',
        designation: 'Frontend Engineer',
        managerId: manager._id,
        phone: '+91 9876543214',
        dateOfJoining: new Date('2024-02-15'),
        dateOfBirth: new Date('1996-09-14'),
        bankDetails: {
          accountName: 'Priya Sharma',
          accountNumber: '112233445566',
          bankName: 'Kotak Mahindra Bank',
          ifscCode: 'KKBK0009988',
        },
        isActive: true,
      });
      await this.balanceModel.create({
        userId: priya._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 182,
        paternity: 0,
      });
      await this.seedDemoAttendance(priya._id, 'Hyderabad Branch');
    }

    // Male Employee: Vijay Kumaran (Chennai Main Campus, 3-Day Paid Paternity)
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
        branch: 'Chennai Main Campus',
        designation: 'Software Engineer',
        managerId: manager._id,
        phone: '+91 9876543215',
        dateOfJoining: new Date('2024-03-01'),
        dateOfBirth: new Date('1997-09-08'),
        bankDetails: {
          accountName: 'Vijay Kumaran',
          accountNumber: '998877665544',
          bankName: 'Canara Bank',
          ifscCode: 'CNRB0002233',
        },
        isActive: true,
      });
      await this.balanceModel.create({
        userId: vijay._id,
        year: 2026,
        annual: 15,
        casual: 12,
        sick: 10,
        maternity: 0,
        paternity: 3,
      });
      await this.seedDemoAttendance(vijay._id, 'Chennai Main Campus');
    }
  }

  async seedDemoAttendance(userId: any, branchName: string = 'Chennai Main Campus') {
    const targetMonth = 9;
    const targetYear = 2026;

    const sampleDays = [
      { day: 1, status: AttendanceStatus.PRESENT, in: '09:35:00', out: '19:05:00', min: 510, isLate: false },
      { day: 2, status: AttendanceStatus.PRESENT, in: '09:42:00', out: '19:10:00', min: 508, isLate: true }, // Late 1 (Grace)
      { day: 3, status: AttendanceStatus.PRESENT, in: '09:44:00', out: '19:00:00', min: 500, isLate: true }, // Late 2 (Grace)
      { day: 4, status: AttendanceStatus.LEAVE, in: null, out: null, min: 0, isLate: false },
      { day: 7, status: AttendanceStatus.PRESENT, in: '09:43:00', out: '19:15:00', min: 512, isLate: true }, // Late 3 (Grace)
      { day: 8, status: AttendanceStatus.HALF_DAY, in: '09:50:00', out: '19:00:00', min: 490, isLate: true, isLatePenalty: true }, // Late 4 (Half-day penalty)
      { day: 9, status: AttendanceStatus.PRESENT, in: '09:38:00', out: '19:00:00', min: 502, isLate: false },
      { day: 10, status: AttendanceStatus.WFH, in: '09:35:00', out: '19:00:00', min: 505, isLate: false },
      { day: 11, status: AttendanceStatus.PRESENT, in: '09:30:00', out: '19:00:00', min: 510, isLate: false },
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
          branchName,
          checkInTime: s.in ? new Date(`${dateStr}T${s.in}.000Z`) : null,
          checkOutTime: s.out ? new Date(`${dateStr}T${s.out}.000Z`) : null,
          totalWorkingMinutes: s.min,
          breakMinutes: 60,
          isLate: s.isLate,
          lateMinutes: s.isLate ? 5 : 0,
          isLatePenaltyApplied: s.isLatePenalty || false,
          latePenaltyType: s.isLatePenalty ? 'HALF_DAY_DEDUCTION' : 'NONE',
          notes: s.isLatePenalty ? '4th Late arrival: Half-day salary deduction' : s.isLate ? 'Late arrival in grace' : 'On-time',
        });
      }
    }
  }
}
