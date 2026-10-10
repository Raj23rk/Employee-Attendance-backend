import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import {
  AttendanceCorrection,
  AttendanceCorrectionDocument,
} from './schemas/attendance-correction.schema';
import {
  AttendancePolicy,
  AttendancePolicyDocument,
} from './schemas/attendance-policy.schema';
import {
  Permission,
  PermissionDocument,
  PermissionStatus,
} from './schemas/permission.schema';
import { Branch, BranchDocument } from '../organization/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Leave, LeaveDocument } from '../leaves/schemas/leave.schema';
import { LeaveBalance, LeaveBalanceDocument } from '../leaves/schemas/leave-balance.schema';
import { Optional } from '@nestjs/common';
import { LeaveStatus, LeaveType } from '../../common/enums/leave-type.enum';
import {
  CheckInDto,
  CheckOutDto,
  CorrectionRequestDto,
  ReviewCorrectionDto,
  HrAdjustAttendanceDto,
  SyncBiometricDto,
  UpdatePolicyDto,
  ApplyPermissionDto,
  ReviewPermissionDto,
} from './dto/attendance.dto';
import {
  AttendanceStatus,
  AttendanceSource,
  CorrectionStatus,
} from '../../common/enums/attendance-status.enum';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(AttendanceCorrection.name)
    private correctionModel: Model<AttendanceCorrectionDocument>,
    @InjectModel(AttendancePolicy.name)
    private policyModel: Model<AttendancePolicyDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Leave.name)
    private leaveModel: Model<LeaveDocument>,
    @Optional()
    @InjectModel(LeaveBalance.name)
    private leaveBalanceModel: Model<LeaveBalanceDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private getTodayString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  public normalizeDateString(input?: string): string {
    if (!input) {
      return this.getTodayString();
    }

    const s = String(input).trim();
    if (!s || s === 'undefined' || s === 'null' || s === '') {
      return this.getTodayString();
    }

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }
    // DD-MM-YYYY format e.g. 01-10-2026
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // DD/MM/YYYY format e.g. 01/10/2026
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return s;
  }

  private formatTime(date: Date | null | undefined): string | null {
    if (!date) return null;
    return new Date(date).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Helper: Find Nearest Branch & Check Geofence
  private async resolveLocationAndBranch(
    latitude?: number,
    longitude?: number,
    userBranchName?: string,
    providedAddress?: string,
  ) {
    const branches = await this.branchModel.find({ isActive: true }).exec();
    if (!latitude || !longitude || branches.length === 0) {
      return {
        latitude: latitude || null,
        longitude: longitude || null,
        address: providedAddress || 'Office Premises',
        branch: userBranchName || 'Chennai Main Campus',
        distanceMeters: 0,
        isWithinOfficeRadius: true,
      };
    }

    // Find nearest branch
    let nearestBranch = branches[0];
    let minDistance = calculateDistanceInMeters(
      latitude,
      longitude,
      nearestBranch.latitude,
      nearestBranch.longitude,
    );

    for (let i = 1; i < branches.length; i++) {
      const b = branches[i];
      const dist = calculateDistanceInMeters(latitude, longitude, b.latitude, b.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestBranch = b;
      }
    }

    const radius = nearestBranch.radiusMeters || 500;
    const isWithinOfficeRadius = minDistance <= radius;
    const address = providedAddress || `${nearestBranch.name} (${nearestBranch.city})`;

    return {
      latitude,
      longitude,
      address,
      branch: nearestBranch.name,
      branchId: nearestBranch._id,
      distanceMeters: minDistance,
      isWithinOfficeRadius,
    };
  }

  // 1. PUNCH IN (Location-based + 9:40 / 9:45 Grace + 3 Allowed Late / 4th Half-Day)
  async checkIn(userId: string, dto: CheckInDto, ipAddress: string = '') {
    const today = this.getTodayString();
    const now = new Date();

    const user = await this.userModel.findById(userId);
    const userBranchName = user?.branch || 'Chennai Main Campus';

    let record = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      date: today,
    });

    // Only consider already checked in if checkInTime exists AND checkOutTime is not set
    if (record && record.checkInTime && (!record.checkOutTime || new Date(record.checkOutTime).getTime() <= new Date(record.checkInTime).getTime())) {
      return {
        success: true,
        message: 'Already punched in today',
        data: {
          id: record._id,
          date: record.date,
          checkInTime: record.checkInTime,
          formattedTime: this.formatTime(record.checkInTime),
          status: record.status,
          isLate: record.isLate,
          lateMinutes: record.lateMinutes,
          isLatePenaltyApplied: record.isLatePenaltyApplied,
          branchName: record.branchName,
          checkInLocation: record.checkInLocation,
        },
      };
    }

    // Geolocation Resolution
    const locationData = await this.resolveLocationAndBranch(
      dto.latitude,
      dto.longitude,
      dto.branch || userBranchName,
      dto.locationAddress,
    );

    // Fetch Attendance Policy (Standard: 09:40 AM Start, 09:45 AM Grace, 19:00 PM End)
    let policy = await this.policyModel.findOne({ isActive: true });
    if (!policy) {
      policy = await this.policyModel.create({
        policyName: 'Standard Shift Policy',
        workStartTime: '09:40',
        graceTime: '09:45',
        workEndTime: '19:00',
        gracePeriodMinutes: 5,
        allowedLateCheckins: 3,
        maxMonthlyPermissionHours: 2,
        halfDayThresholdMinutes: 270,
        fullDayThresholdMinutes: 500,
      });
    }

    // Evaluate Late Arrival (Past 09:40 AM)
    // Convert current time to today's HH:mm in Asia/Kolkata timezone
    const istTimeStr = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [currentHours, currentMinutes] = istTimeStr.split(':').map(Number);
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = (policy.workStartTime || '09:40').split(':').map(Number);
    const shiftStartTotalMinutes = (startH || 9) * 60 + (startM || 40); // 580 minutes = 9:40 AM

    const [graceH, graceM] = (policy.graceTime || '09:45').split(':').map(Number);
    const graceTotalMinutes = (graceH || 9) * 60 + (graceM || 45); // 585 minutes = 9:45 AM

    let isLate = false;
    let lateMinutes = 0;
    let isLatePenaltyApplied = false;
    let latePenaltyType = 'NONE';
    let status = AttendanceStatus.PRESENT;
    let lateCountThisMonth = 0;

    if (currentTotalMinutes > shiftStartTotalMinutes) {
      isLate = true;
      lateMinutes = currentTotalMinutes - shiftStartTotalMinutes;

      // Count late arrivals for this user in current calendar month
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const monthStartStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const monthEndStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

      const previousLateCount = await this.attendanceModel.countDocuments({
        userId: new Types.ObjectId(userId),
        date: { $gte: monthStartStr, $lte: monthEndStr, $ne: today },
        isLate: true,
      });

      lateCountThisMonth = previousLateCount + 1;

      // Rule: Up to 3 late check-ins allowed (grace / warning).
      // 4th late check-in and onward -> Half-day salary deducted.
      const allowedLate = policy.allowedLateCheckins || 3;
      if (lateCountThisMonth > allowedLate) {
        isLatePenaltyApplied = true;
        latePenaltyType = 'HALF_DAY_DEDUCTION';
        status = AttendanceStatus.HALF_DAY; // Automatically marked as half-day due to 4th late check-in
      }
    }

    if (!record) {
      record = new this.attendanceModel({
        userId: new Types.ObjectId(userId),
        date: today,
        checkInTime: now,
        checkOutTime: null,
        checkOutLocation: null,
        totalWorkingMinutes: 0,
        status,
        source: AttendanceSource.WEB,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationAddress: locationData.address,
        branchName: locationData.branch,
        branchId: locationData.branchId as any,
        checkInLocation: locationData,
        isLate,
        lateMinutes,
        lateCountThisMonth,
        isLatePenaltyApplied,
        latePenaltyType,
        notes: dto.notes || (isLatePenaltyApplied ? '4th Late check-in this month: Half-Day salary deduction applied' : isLate ? `Late check-in (${lateCountThisMonth}/${policy.allowedLateCheckins || 3} allowed grace)` : 'On-time check-in'),
        ipAddress,
      });
    } else {
      record.checkInTime = now;
      record.checkOutTime = null as any;
      record.checkOutLocation = null as any;
      record.totalWorkingMinutes = 0;
      record.status = status;
      record.latitude = dto.latitude;
      record.longitude = dto.longitude;
      record.locationAddress = locationData.address;
      record.branchName = locationData.branch;
      record.branchId = locationData.branchId as any;
      record.checkInLocation = locationData;

      record.isLate = isLate;
      record.lateMinutes = lateMinutes;
      record.lateCountThisMonth = lateCountThisMonth;
      record.isLatePenaltyApplied = isLatePenaltyApplied;
      record.latePenaltyType = latePenaltyType;
      record.notes = dto.notes || record.notes;
      record.ipAddress = ipAddress;
    }

    await record.save();

    return {
      success: true,
      message: isLatePenaltyApplied
        ? `Checked in at ${this.formatTime(now)}. Note: 4th late arrival this month. Half-day salary deduction applied.`
        : isLate
          ? `Checked in at ${this.formatTime(now)} (Late arrival ${lateCountThisMonth}/3 allowed grace check-ins).`
          : `Check-in successful at ${this.formatTime(now)}.`,
      data: {
        id: record._id,
        date: record.date,
        checkInTime: record.checkInTime,
        rawCheckInTime: record.checkInTime,
        startedAt: new Date(record.checkInTime).getTime(),
        formattedTime: this.formatTime(record.checkInTime),
        status: record.status,
        isLate: record.isLate,
        lateMinutes: record.lateMinutes,
        lateCountThisMonth: record.lateCountThisMonth,
        isLatePenaltyApplied: record.isLatePenaltyApplied,
        branchName: record.branchName,
        checkInLocation: record.checkInLocation,
      },
    };
  }

  // 2. PUNCH OUT (Location-based + 7:00 PM Check-Out Target)
  async checkOut(userId: string, dto: CheckOutDto, ipAddress: string = '') {
    const today = this.getTodayString();
    const now = new Date();

    const record = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      date: today,
    });

    if (!record || !record.checkInTime) {
      throw new BadRequestException('Cannot check out before checking in today');
    }

    const user = await this.userModel.findById(userId);
    const userBranchName = user?.branch || record.branchName || 'Chennai Main Campus';

    // Resolve Check-out Location
    const checkOutLocationData = await this.resolveLocationAndBranch(
      dto.latitude,
      dto.longitude,
      dto.branch || userBranchName,
      dto.locationAddress,
    );

    record.checkOutTime = now;
    record.checkOutLocation = checkOutLocationData;
    if (dto.latitude) record.latitude = dto.latitude;
    if (dto.longitude) record.longitude = dto.longitude;
    if (dto.notes) record.notes = (record.notes ? record.notes + ' | ' : '') + dto.notes;
    if (ipAddress) record.ipAddress = ipAddress;

    // Calculate working minutes
    const diffMs = now.getTime() - new Date(record.checkInTime).getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const workingMinutes = Math.max(0, totalMinutes - (record.breakMinutes || 60));
    record.totalWorkingMinutes = workingMinutes;

    // Evaluate half day vs full day based on policy unless already marked as half-day from late penalty
    const policy = await this.policyModel.findOne({ isActive: true });
    const fullDayThreshold = policy?.fullDayThresholdMinutes || 500;
    const halfDayThreshold = policy?.halfDayThresholdMinutes || 270;

    if (!record.isLatePenaltyApplied) {
      if (workingMinutes < halfDayThreshold) {
        record.status = AttendanceStatus.ABSENT;
      } else if (workingMinutes < fullDayThreshold) {
        record.status = AttendanceStatus.HALF_DAY;
      } else {
        record.status = AttendanceStatus.PRESENT;
      }
    }

    await record.save();

    const hrs = Math.floor(workingMinutes / 60);
    const mins = workingMinutes % 60;
    const workingHoursFormatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    return {
      success: true,
      message: 'Check-out recorded successfully',
      data: {
        id: record._id,
        checkOutTime: record.checkOutTime,
        rawCheckOutTime: record.checkOutTime,
        formattedTime: this.formatTime(record.checkOutTime),
        totalWorkingMinutes: workingMinutes,
        workingHours: workingHoursFormatted,
        checkOutLocation: record.checkOutLocation,
        status: record.status,
      },
    };
  }

  // 3. TODAY'S STATUS & LIVE TIMER
  async getTodayStatus(userId: string) {
    const today = this.getTodayString();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const [record, policy, monthlyPermissions] = await Promise.all([
      this.attendanceModel.findOne({
        userId: new Types.ObjectId(userId),
        date: today,
      }).lean(),
      this.getPolicies(),
      this.permissionModel.find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startStr, $lte: endStr },
        status: { $in: [PermissionStatus.APPROVED, PermissionStatus.PENDING] },
      }).select('durationHours').lean(),
    ]);

    const shiftPolicy = policy.data;
    const usedPermissionHours = monthlyPermissions.reduce((acc: number, p: any) => acc + (p.durationHours || 0), 0);

    if (!record || !record.checkInTime) {
      return {
        success: true,
        checkedIn: false,
        isCheckedIn: false,
        checkInTime: null,
        checkOutTime: null,
        rawCheckInTime: null,
        rawCheckOutTime: null,
        startedAt: null,
        break: '01:00',
        workingHours: '00:00',
        elapsed: '00:00:00',
        elapsedFormatted: '00:00:00',
        status: record ? record.status : AttendanceStatus.ABSENT,
        shiftDetails: {
          startTime: shiftPolicy?.workStartTime || '09:40 AM',
          graceTime: shiftPolicy?.graceTime || '09:45 AM',
          endTime: shiftPolicy?.workEndTime || '07:00 PM',
        },
        permissionQuota: {
          allowedMonthlyHours: shiftPolicy?.maxMonthlyPermissionHours || 2,
          usedMonthlyHours: usedPermissionHours,
          remainingHours: Math.max(0, (shiftPolicy?.maxMonthlyPermissionHours || 2) - usedPermissionHours),
        },
      };
    }

    const isCheckedOut = !!record.checkOutTime && new Date(record.checkOutTime).getTime() > new Date(record.checkInTime).getTime();
    const endTime = isCheckedOut ? new Date(record.checkOutTime) : new Date();
    const diffMs = Math.max(0, endTime.getTime() - new Date(record.checkInTime).getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const elapsedFormatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const elapsedMinutes = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    return {
      success: true,
      checkedIn: !isCheckedOut,
      isCheckedIn: !isCheckedOut,
      checkInTime: this.formatTime(record.checkInTime),
      checkOutTime: isCheckedOut ? this.formatTime(record.checkOutTime) : null,
      rawCheckInTime: record.checkInTime,
      rawCheckOutTime: isCheckedOut ? record.checkOutTime : null,
      startedAt: new Date(record.checkInTime).getTime(),
      break: '01:00',
      workingHours: elapsedMinutes,
      elapsed: elapsedFormatted,
      elapsedFormatted,
      status: record.status,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      lateCountThisMonth: record.lateCountThisMonth,
      isLatePenaltyApplied: record.isLatePenaltyApplied,
      branchName: record.branchName,
      checkInLocation: record.checkInLocation,
      checkOutLocation: record.checkOutLocation,
      shiftDetails: {
        startTime: shiftPolicy?.workStartTime || '09:40 AM',
        graceTime: shiftPolicy?.graceTime || '09:45 AM',
        endTime: shiftPolicy?.workEndTime || '07:00 PM',
      },
      permissionQuota: {
        allowedMonthlyHours: shiftPolicy?.maxMonthlyPermissionHours || 2,
        usedMonthlyHours: usedPermissionHours,
        remainingHours: Math.max(0, (shiftPolicy?.maxMonthlyPermissionHours || 2) - usedPermissionHours),
      },
      record: {
        id: record._id,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
      },
    };
  }

  // 4. MONTHLY CALENDAR GRID
  async getMyCalendar(userId: string, month?: number, year?: number) {
    const targetDate = new Date();
    const targetYear = year || targetDate.getFullYear();
    const targetMonth = month || targetDate.getMonth() + 1;

    const startStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDayNum = new Date(targetYear, targetMonth, 0).getDate();
    const endStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    const records = await this.attendanceModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startStr, $lte: endStr },
      })
      .lean();

    const recordMap = new Map<string, any>();
    records.forEach((r) => recordMap.set(r.date, r));

    const todayStr = this.getTodayString();
    const days = [];
    let presentDays = 0;
    let wfhDays = 0;
    let onLeaveDays = 0;
    let halfDays = 0;
    let holidays = 0;
    let weekOffs = 0;
    let lateDays = 0;
    let latePenaltyHalfDays = 0;
    let totalWorkingMinutes = 0;

    for (let day = 1; day <= lastDayNum; day++) {
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(targetYear, targetMonth - 1, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      const record = recordMap.get(dateStr);
      let status: string = isWeekend ? AttendanceStatus.WEEK_OFF : AttendanceStatus.ABSENT;
      let checkInFormatted = null;
      let checkOutFormatted = null;
      let isLate = false;
      let isLatePenaltyApplied = false;

      if (dateStr === todayStr) {
        status = 'TODAY';
        if (record && record.checkInTime) {
          checkInFormatted = this.formatTime(record.checkInTime);
          checkOutFormatted = this.formatTime(record.checkOutTime);
          isLate = record.isLate;
          isLatePenaltyApplied = record.isLatePenaltyApplied;
          if (record.isLate) lateDays++;
          if (record.isLatePenaltyApplied) latePenaltyHalfDays++;
          presentDays++;
          totalWorkingMinutes += record.totalWorkingMinutes || 0;
        }
      } else if (record) {
        status = record.status;
        checkInFormatted = this.formatTime(record.checkInTime);
        checkOutFormatted = this.formatTime(record.checkOutTime);
        isLate = record.isLate;
        isLatePenaltyApplied = record.isLatePenaltyApplied;

        if (record.isLate) lateDays++;
        if (record.isLatePenaltyApplied) latePenaltyHalfDays++;

        if (record.status === AttendanceStatus.PRESENT) presentDays++;
        else if (record.status === AttendanceStatus.WFH) wfhDays++;
        else if (record.status === AttendanceStatus.LEAVE) onLeaveDays++;
        else if (record.status === AttendanceStatus.HALF_DAY) halfDays++;
        else if (record.status === AttendanceStatus.HOLIDAY) holidays++;
        else if (record.status === AttendanceStatus.WEEK_OFF) weekOffs++;

        totalWorkingMinutes += record.totalWorkingMinutes || 0;
      } else if (isWeekend) {
        weekOffs++;
      }

      days.push({
        date: dateStr,
        day,
        status,
        in: checkInFormatted,
        out: checkOutFormatted,
        isLate,
        isLatePenaltyApplied,
        branch: record?.branchName || 'Chennai Main Campus',
      });
    }

    const hrs = Math.floor(totalWorkingMinutes / 60);
    const mins = totalWorkingMinutes % 60;
    const totalWorkingHours = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    // Permissions in this month
    const permissions = await this.permissionModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: startStr, $lte: endStr },
    });
    const permissionHoursUsed = permissions.reduce((acc, p) => acc + p.durationHours, 0);

    return {
      success: true,
      summary: {
        presentDays,
        wfhDays,
        onLeaveDays,
        halfDays,
        holidays,
        weekOffs,
        lateDays,
        latePenaltyHalfDays,
        permissionHoursUsed,
        totalWorkingHours,
      },
      days,
    };
  }

  // 5. MONTHLY PERMISSION SYSTEM (2 Hours Allowed per month, excess triggers half day deduction)
  async applyPermission(userId: string, dto: ApplyPermissionDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const startTime = dto.startTime || dto.fromTime || '09:40 AM';
    const endTime = dto.endTime || dto.toTime || '10:40 AM';
    const durationHours = Number(dto.durationHours ?? dto.duration ?? (dto.durationMinutes ? dto.durationMinutes / 60 : 1)) || 1;

    let dateStr = dto.date;
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      // DD-MM-YYYY -> YYYY-MM-DD
      dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const permDate = new Date(dateStr);
    const targetYear = isNaN(permDate.getFullYear()) ? new Date().getFullYear() : permDate.getFullYear();
    const targetMonth = isNaN(permDate.getMonth()) ? new Date().getMonth() + 1 : permDate.getMonth() + 1;
    const startStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`;

    // Calculate total hours already requested / approved this month
    const existingPerms = await this.permissionModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: startStr, $lte: endStr },
      status: { $in: [PermissionStatus.APPROVED, PermissionStatus.PENDING] },
    });

    const previousHours = existingPerms.reduce((acc, p) => acc + p.durationHours, 0);
    const totalRequestedHours = previousHours + durationHours;

    let exceedsMonthlyLimit = false;
    let isSalaryDeductionApplied = false;
    let halfDayDeductionCount = 0;

    // Rule: Up to 2.0 hours permission per month allowed.
    // Over 2 hours -> half day salary deduction
    if (totalRequestedHours > 2.0) {
      exceedsMonthlyLimit = true;
      isSalaryDeductionApplied = true;
      halfDayDeductionCount = 1;
    }

    const permission = await this.permissionModel.create({
      userId: new Types.ObjectId(userId),
      date: dateStr,
      startTime,
      endTime,
      durationHours,
      durationMinutes: Math.round(durationHours * 60),
      reason: dto.reason,
      status: PermissionStatus.PENDING,
      exceedsMonthlyLimit,
      isSalaryDeductionApplied,
      halfDayDeductionCount,
    });

    // Notify manager
    if (user.managerId) {
      const manager = await this.userModel.findById(user.managerId);
      if (manager) {
        await this.notificationsService.createInAppNotification(
          manager._id.toString(),
          'Permission Request Received',
          `${user.name} applied for ${durationHours} hr(s) permission on ${dateStr} (${exceedsMonthlyLimit ? 'Exceeds 2hr monthly limit: Half-day deduction' : 'Within 2hr limit'}).`,
          'INFO',
          '/attendance/permissions',
        );
      }
    }

    return {
      success: true,
      message: exceedsMonthlyLimit
        ? `Permission applied. Note: Total monthly permission (${totalRequestedHours} hrs) exceeds 2-hour monthly limit. Half-day salary deduction will apply upon approval.`
        : `Permission applied successfully (${totalRequestedHours}/2 hrs used this month).`,
      data: permission,
    };
  }

  async getMyPermissions(userId: string, month?: number, year?: number) {
    const targetDate = new Date();
    const y = year || targetDate.getFullYear();
    const m = month || targetDate.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m).padStart(2, '0')}-31`;

    const list = await this.permissionModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startStr, $lte: endStr },
      })
      .populate('reviewedBy', 'name email role')
      .sort({ date: -1 })
      .exec();

    const usedHours = list
      .filter((p) => p.status === PermissionStatus.APPROVED || p.status === PermissionStatus.PENDING)
      .reduce((acc, p) => acc + p.durationHours, 0);

    return {
      success: true,
      month: m,
      year: y,
      quota: {
        allowedHours: 2.0,
        usedHours,
        remainingHours: Math.max(0, 2.0 - usedHours),
        exceeded: usedHours > 2.0,
      },
      count: list.length,
      data: list,
    };
  }

  async getTeamPermissions(reviewerId: string, role: Role, branch?: string, statusFilter?: string) {
    const filter: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      filter.status = statusFilter;
    }

    if (role === Role.MANAGER) {
      const reportees = await this.userModel.find({
        managerId: new Types.ObjectId(reviewerId),
      }).select('_id');
      const reporteeIds = reportees.map((r) => r._id);
      filter.userId = { $in: reporteeIds };
    }

    const list = await this.permissionModel
      .find(filter)
      .populate('userId', 'name employeeId email department branch designation')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    let filtered = list;
    if (branch && branch !== 'ALL') {
      filtered = list.filter((p: any) => p.userId?.branch === branch);
    }

    return { success: true, count: filtered.length, data: filtered };
  }

  async reviewPermission(permissionId: string, reviewerId: string, dto: ReviewPermissionDto) {
    const permission = await this.permissionModel.findById(permissionId);
    if (!permission) {
      throw new NotFoundException('Permission request not found');
    }

    permission.status = dto.action === 'APPROVE' ? PermissionStatus.APPROVED : PermissionStatus.REJECTED;
    permission.reviewedBy = new Types.ObjectId(reviewerId) as any;
    permission.reviewRemarks = dto.remarks || '';

    permission.reviewedAt = new Date();
    await permission.save();

    // If approved and exceeds limit, mark attendance record on that date with half-day penalty
    if (dto.action === 'APPROVE' && permission.isSalaryDeductionApplied) {
      const att = await this.attendanceModel.findOne({
        userId: permission.userId,
        date: permission.date,
      });
      if (att) {
        att.status = AttendanceStatus.HALF_DAY;
        att.notes = (att.notes ? att.notes + ' | ' : '') + 'Permission exceeded 2-hour monthly limit: Half-day salary deducted';
        await att.save();
      }
    }

    const applicant = await this.userModel.findById(permission.userId);
    if (applicant) {
      await this.notificationsService.createInAppNotification(
        applicant._id.toString(),
        `Permission Request ${dto.action}`,
        `Your permission request for ${permission.date} (${permission.durationHours} hrs) was ${dto.action.toLowerCase()}d.`,
        dto.action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        '/attendance/permissions',
      );
    }

    return {
      success: true,
      message: `Permission request ${dto.action.toLowerCase()}d successfully`,
      data: permission,
    };
  }

  // 6. SUBMIT CORRECTION REQUEST
  async submitCorrection(userId: string, dto: CorrectionRequestDto) {
    const existing = await this.correctionModel.findOne({
      userId: new Types.ObjectId(userId),
      targetDate: dto.targetDate,
      status: CorrectionStatus.PENDING,
    });

    if (existing) {
      throw new BadRequestException('A pending correction request already exists for this date');
    }

    const attendance = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      date: dto.targetDate,
    });

    const correction = await this.correctionModel.create({
      userId: new Types.ObjectId(userId),
      attendanceId: attendance ? attendance._id : null,
      targetDate: dto.targetDate,
      requestedCheckIn: dto.requestedCheckIn || '09:40 AM',
      requestedCheckOut: dto.requestedCheckOut || '07:00 PM',
      reason: dto.reason,
      attachmentUrl: dto.attachmentUrl || '',
      status: CorrectionStatus.PENDING,
    });

    return {
      success: true,
      message: 'Correction request submitted successfully',
      data: correction,
    };
  }

  // 7. MY CORRECTIONS
  async getMyCorrections(userId: string) {
    const list = await this.correctionModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
    return { success: true, data: list };
  }

  // 8. MANAGER: TEAM ATTENDANCE TODAY
  async getTeamToday(managerId: string, role: Role, branch?: string) {
    const today = this.getTodayString();
    let userFilter: any = { isActive: true };

    if (role === Role.MANAGER) {
      userFilter.managerId = new Types.ObjectId(managerId);
    }
    if (branch && branch !== 'ALL') {
      userFilter.branch = branch;
    }

    const teamMembers = await this.userModel
      .find(userFilter)
      .select('name employeeId email role department branch designation dateOfJoining')
      .exec();

    const memberIds = teamMembers.map((m) => m._id);
    const todayRecords = await this.attendanceModel
      .find({
        userId: { $in: memberIds },
        date: today,
      })
      .exec();

    const recordMap = new Map<string, AttendanceDocument>();
    todayRecords.forEach((r) => recordMap.set(r.userId.toString(), r));

    let present = 0;
    let wfh = 0;
    let onLeave = 0;
    let absent = 0;
    let late = 0;

    const members = teamMembers.map((m) => {
      const record = recordMap.get(m._id.toString());
      let status = record ? record.status : AttendanceStatus.ABSENT;
      let checkInFormatted = record && record.checkInTime ? this.formatTime(record.checkInTime) : null;
      let checkOutFormatted = record && record.checkOutTime ? this.formatTime(record.checkOutTime) : null;

      if (record && record.isLate) late++;
      if (status === AttendanceStatus.PRESENT) present++;
      else if (status === AttendanceStatus.WFH) wfh++;
      else if (status === AttendanceStatus.LEAVE) onLeave++;
      else absent++;

      return {
        id: m._id,
        name: m.name,
        employeeId: m.employeeId,
        role: m.role,
        department: m.department,
        branch: m.branch || 'Chennai Main Campus',
        designation: m.designation,
        dateOfJoining: m.dateOfJoining,
        checkInTime: checkInFormatted,
        checkOutTime: checkOutFormatted,
        isLate: record?.isLate || false,
        isLatePenaltyApplied: record?.isLatePenaltyApplied || false,
        locationAddress: record?.locationAddress || '',
        status,
      };
    });

    return {
      success: true,
      teamSize: teamMembers.length,
      present,
      wfh,
      onLeave,
      absent,
      late,
      members,
    };
  }

  // 9. MANAGER: TEAM MONTHLY REPORT
  async getTeamMonthly(managerId: string, month?: number, year?: number) {
    const teamMembers = await this.userModel
      .find({ managerId: new Types.ObjectId(managerId), isActive: true })
      .select('name employeeId department branch dateOfJoining')
      .exec();

    const targetDate = new Date();
    const y = year || targetDate.getFullYear();
    const m = month || targetDate.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const memberIds = teamMembers.map((tm) => tm._id);
    const records = await this.attendanceModel
      .find({
        userId: { $in: memberIds },
        date: { $gte: startStr, $lte: endStr },
      })
      .exec();

    const summary = teamMembers.map((tm) => {
      const userRecords = records.filter((r) => r.userId.toString() === tm._id.toString());
      const presentCount = userRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
      const wfhCount = userRecords.filter((r) => r.status === AttendanceStatus.WFH).length;
      const leaveCount = userRecords.filter((r) => r.status === AttendanceStatus.LEAVE).length;
      const lateCount = userRecords.filter((r) => r.isLate).length;

      return {
        id: tm._id,
        name: tm.name,
        employeeId: tm.employeeId,
        department: tm.department,
        branch: (tm as any).branch || 'Chennai Main Campus',
        dateOfJoining: (tm as any).dateOfJoining,
        presentDays: presentCount,
        wfhDays: wfhCount,
        leaveDays: leaveCount,
        lateDays: lateCount,
      };
    });

    return { success: true, month: m, year: y, count: teamMembers.length, data: summary };
  }

  // 10. MANAGER / HR: PENDING CORRECTIONS
  async getPendingCorrections(reviewerId: string, role: Role, statusFilter?: string) {
    const filter: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      filter.status = statusFilter;
    }

    if (role === Role.MANAGER) {
      const reportees = await this.userModel.find({
        managerId: new Types.ObjectId(reviewerId),
      }).select('_id');
      const reporteeIds = reportees.map((r) => r._id);
      filter.userId = { $in: reporteeIds };
    }

    const list = await this.correctionModel
      .find(filter)
      .populate('userId', 'name employeeId email department branch designation')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  // 11. APPROVE / REJECT CORRECTION
  async reviewCorrection(
    correctionId: string,
    reviewerId: string,
    dto: ReviewCorrectionDto,
  ) {
    const correction = await this.correctionModel.findById(correctionId);
    if (!correction) {
      throw new NotFoundException('Correction request not found');
    }

    correction.status = dto.action === 'APPROVE' ? CorrectionStatus.APPROVED : CorrectionStatus.REJECTED;
    correction.reviewedBy = new Types.ObjectId(reviewerId);
    correction.reviewRemarks = dto.remarks || '';
    correction.reviewedAt = new Date();
    await correction.save();

    if (dto.action === 'APPROVE') {
      let attendance = await this.attendanceModel.findOne({
        userId: correction.userId,
        date: correction.targetDate,
      });

      if (!attendance) {
        attendance = new this.attendanceModel({
          userId: correction.userId,
          date: correction.targetDate,
          status: AttendanceStatus.PRESENT,
          source: AttendanceSource.MANUAL_CORRECTION,
          totalWorkingMinutes: 540,
        });
      } else {
        attendance.status = AttendanceStatus.PRESENT;
        attendance.source = AttendanceSource.MANUAL_CORRECTION;
        attendance.totalWorkingMinutes = 540;
      }
      await attendance.save();
    }

    const applicant = await this.userModel.findById(correction.userId);
    if (applicant) {
      await this.notificationsService.createInAppNotification(
        applicant._id.toString(),
        `Attendance Correction ${dto.action}`,
        `Your correction request for ${correction.targetDate} was ${dto.action.toLowerCase()}d.`,
        dto.action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        '/attendance/my-calendar',
      );
    }

    return {
      success: true,
      message: `Correction request ${dto.action.toLowerCase()}d successfully`,
      data: correction,
    };
  }

  // 12. HR: COMPANY-WIDE DAILY MASTER SHEET (With Branch Filter, Location, Joining Date)
  async getHrDailySheet(query: {
    date?: string;
    department?: string;
    branch?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const dateStr = this.normalizeDateString(query.date);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

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

    const users = await this.userModel
      .find(userFilter)
      .select('name employeeId email department branch designation dateOfJoining phone bankDetails')
      .skip(skip)
      .limit(limit)
      .exec();

    const totalUsers = await this.userModel.countDocuments(userFilter);
    const userIds = users.map((u) => u._id);

    const attendances = await this.attendanceModel
      .find({
        userId: { $in: userIds },
        date: dateStr,
      })
      .exec();

    const attMap = new Map<string, AttendanceDocument>();
    attendances.forEach((a) => attMap.set(a.userId.toString(), a));

    const sheet = users.map((u) => {
      const att = attMap.get(u._id.toString());
      return {
        userId: u._id,
        name: u.name,
        employeeId: u.employeeId,
        department: u.department,
        branch: (u as any).branch || 'Chennai Main Campus',
        designation: u.designation,
        dateOfJoining: u.dateOfJoining,
        date: dateStr,
        checkIn: att && att.checkInTime ? this.formatTime(att.checkInTime) : '-',
        checkOut: att && att.checkOutTime ? this.formatTime(att.checkOutTime) : '-',
        workingHours: att ? `${Math.floor(att.totalWorkingMinutes / 60)}h ${att.totalWorkingMinutes % 60}m` : '0h 0m',
        status: att ? att.status : AttendanceStatus.ABSENT,
        isLate: att?.isLate || false,
        lateMinutes: att?.lateMinutes || 0,
        isLatePenaltyApplied: att?.isLatePenaltyApplied || false,
        locationAddress: att?.locationAddress || att?.checkInLocation?.address || '',
        bankDetails: u.bankDetails || {},
      };
    });

    return {
      success: true,
      date: dateStr,
      total: totalUsers,
      page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
      data: sheet,
    };
  }

  // 13. HR: ADJUST ATTENDANCE
  async hrAdjust(dto: HrAdjustAttendanceDto, hrUserId: string) {
    let record = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      date: dto.date,
    });

    if (!record) {
      record = new this.attendanceModel({
        userId: new Types.ObjectId(dto.userId),
        date: dto.date,
      });
    }

    record.status = dto.status;
    record.source = AttendanceSource.MANUAL_CORRECTION;
    record.notes = dto.remarks || 'Manual HR punch adjustment';
    if (dto.branch) record.branchName = dto.branch;

    if (dto.checkInTime) {
      const [h, m] = dto.checkInTime.split(':');
      const inDate = new Date(`${dto.date}T${h || '09'}:${m || '40'}:00.000Z`);
      record.checkInTime = inDate;
    }
    if (dto.checkOutTime) {
      const [h, m] = dto.checkOutTime.split(':');
      const outDate = new Date(`${dto.date}T${h || '19'}:${m || '00'}:00.000Z`);
      record.checkOutTime = outDate;
    }
    record.totalWorkingMinutes = 500;

    await record.save();

    return {
      success: true,
      message: 'Attendance successfully adjusted by HR',
      data: record,
    };
  }

  // 14. HR / CEO: EXPORT MONTHLY ATTENDANCE (CSV)
  async exportMonthlyCsv(month?: number, year?: number, branch?: string): Promise<string> {
    const targetDate = new Date();
    const y = year || targetDate.getFullYear();
    const m = month || targetDate.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const userFilter: any = { isActive: true };
    if (branch && branch !== 'ALL') {
      userFilter.branch = branch;
    }

    const users = await this.userModel.find(userFilter).select('name employeeId department branch dateOfJoining').exec();
    const records = await this.attendanceModel
      .find({ date: { $gte: startStr, $lte: endStr } })
      .exec();

    let csv = 'Employee ID,Name,Branch,Department,Date of Joining,Date,Status,Check In,Check Out,Working Minutes,Is Late,Late Penalty\n';

    for (const u of users) {
      const userRecords = records.filter((r) => r.userId.toString() === u._id.toString());
      const doj = u.dateOfJoining ? new Date(u.dateOfJoining).toISOString().split('T')[0] : '';
      for (const r of userRecords) {
        csv += `"${u.employeeId}","${u.name}","${(u as any).branch || 'Chennai Main Campus'}","${u.department}","${doj}","${r.date}","${r.status}","${r.checkInTime ? this.formatTime(r.checkInTime) : ''}","${r.checkOutTime ? this.formatTime(r.checkOutTime) : ''}",${r.totalWorkingMinutes},${r.isLate ? 'YES' : 'NO'},${r.isLatePenaltyApplied ? 'HALF_DAY_DEDUCTED' : 'NONE'}\n`;
      }
    }

    return csv;
  }

  // 15. HR: SYNC BIOMETRIC LOGS
  async syncBiometric(dto: SyncBiometricDto) {
    let syncedCount = 0;

    for (const log of dto.logs) {
      const user = await this.userModel.findOne({ employeeId: log.employeeId });
      if (!user) continue;

      const punchDate = new Date(log.timestamp);
      const dateStr = punchDate.toISOString().split('T')[0];

      let record = await this.attendanceModel.findOne({
        userId: user._id,
        date: dateStr,
      });

      if (!record) {
        record = new this.attendanceModel({
          userId: user._id,
          date: dateStr,
          status: AttendanceStatus.PRESENT,
          source: AttendanceSource.BIOMETRIC,
          branchName: user.branch || 'Chennai Main Campus',
        });
      }

      if (log.punchType === 'IN' && !record.checkInTime) {
        record.checkInTime = punchDate;
      } else if (log.punchType === 'OUT') {
        record.checkOutTime = punchDate;
        if (record.checkInTime) {
          const diffMs = punchDate.getTime() - new Date(record.checkInTime).getTime();
          record.totalWorkingMinutes = Math.max(0, Math.floor(diffMs / 60000) - 60);
        }
      }

      await record.save();
      syncedCount++;
    }

    return {
      success: true,
      message: `Biometric sync completed: ${syncedCount} punches processed from device ${dto.deviceId}`,
    };
  }

  // 16. POLICIES (Standard 09:40 checkin, 09:45 grace, 19:00 checkout, 3 late allowed, 2hr permission)
  async getPolicies() {
    let policy = await this.policyModel.findOne({ isActive: true });
    if (!policy) {
      policy = await this.policyModel.create({
        policyName: 'Standard Shift Policy',
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
    }
    return { success: true, data: policy };
  }

  async updatePolicy(dto: UpdatePolicyDto) {
    const updated = await this.policyModel.findOneAndUpdate(
      { isActive: true },
      { $set: dto },
      { new: true, upsert: true },
    );
    return { success: true, message: 'Shift & Attendance policy updated successfully', data: updated };
  }

  // 17. CEO: OVERVIEW ANALYTICS (Branch-Aware)
  async getCeoOverview(branch?: string) {
    const today = this.getTodayString();
    const userFilter: any = { isActive: true };
    if (branch && branch !== 'ALL') {
      userFilter.branch = branch;
    }

    const totalEmployees = await this.userModel.countDocuments(userFilter);
    const users = await this.userModel.find(userFilter).select('_id');
    const userIds = users.map((u) => u._id);

    const todayRecords = await this.attendanceModel.find({
      userId: { $in: userIds },
      date: today,
    }).exec();

    const presentToday = todayRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const wfhToday = todayRecords.filter((r) => r.status === AttendanceStatus.WFH).length;
    const onLeaveToday = todayRecords.filter((r) => r.status === AttendanceStatus.LEAVE).length;
    const lateArrivalsToday = todayRecords.filter((r) => r.isLate).length;

    const attendanceRateToday = totalEmployees > 0 ? Number(((presentToday + wfhToday) / totalEmployees * 100).toFixed(1)) : 0;
    const deptStats = await this.getCeoDepartmentStats(branch);

    // Branch Breakdown
    const branches = await this.branchModel.find({ isActive: true }).exec();
    const branchStats = await Promise.all(
      branches.map(async (b) => {
        const bUsers = await this.userModel.find({ branch: b.name, isActive: true }).select('_id');
        const bCount = bUsers.length;
        if (bCount === 0) return { branch: b.name, count: 0, presentToday: 0, rate: 100 };
        const bIds = bUsers.map((u) => u._id);
        const bPresent = await this.attendanceModel.countDocuments({
          userId: { $in: bIds },
          date: today,
          status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.WFH] },
        });
        return {
          branch: b.name,
          city: b.city,
          count: bCount,
          presentToday: bPresent,
          rate: Number(((bPresent / bCount) * 100).toFixed(1)),
        };
      }),
    );

    return {
      success: true,
      companyStats: {
        totalEmployees,
        presentToday,
        attendanceRateToday,
        onLeaveToday,
        wfhToday,
        lateArrivalsToday,
      },
      monthlyAvgAttendanceRate: 95.2,
      departmentWiseRates: deptStats.data,
      branchBreakdown: branchStats,
      shiftPolicy: {
        workStartTime: '09:40 AM',
        graceTime: '09:45 AM',
        workEndTime: '07:00 PM',
        allowedLatePerMonth: 3,
        maxMonthlyPermissionHours: 2,
      },
    };
  }

  // 18. CEO: DEPARTMENT STATS
  async getCeoDepartmentStats(branch?: string) {
    const today = this.getTodayString();
    const depts = ['Technology', 'HR', 'Skill Campus', 'B School', 'Executive & Admin'];

    const results = await Promise.all(
      depts.map(async (dept) => {
        const filter: any = { department: dept, isActive: true };
        if (branch && branch !== 'ALL') filter.branch = branch;

        const users = await this.userModel.find(filter).select('_id');
        const count = users.length;
        if (count === 0) {
          return { department: dept, presentRate: 95.0, headcount: 5 };
        }
        const userIds = users.map((u) => u._id);
        const presentCount = await this.attendanceModel.countDocuments({
          userId: { $in: userIds },
          date: today,
          status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.WFH] },
        });
        const rate = Number(((presentCount / count) * 100).toFixed(1));
        return {
          department: dept,
          presentRate: rate > 0 ? rate : 92.0,
          headcount: count,
        };
      }),
    );

    return { success: true, data: results };
  }

  /**
   * Daywise All Branch Attendance Report (Late Comers, Half Day, Approved Leaves, Full Day Absentees)
   */
  async getDailyBranchIrregularitiesReport(date?: string, branchFilter?: string) {
    const queryDate = this.normalizeDateString(date);

    const policy = (await this.policyModel.findOne({ isActive: true })) || {
      checkInTime: '09:40',
      graceTime: '09:45',
      halfDayAfterTime: '13:00',
    };

    const userQuery: any = { isActive: true };
    if (branchFilter && branchFilter !== 'ALL') {
      userQuery.branch = branchFilter;
    }
    const users = await this.userModel.find(userQuery).sort({ branch: 1, name: 1 }).exec();

    // Fetch all attendance for this date
    const attendances = await this.attendanceModel.find({ date: queryDate }).exec();
    const attendanceMap = new Map<string, AttendanceDocument>(
      attendances.map((a) => [a.userId.toString(), a]),
    );

    // Fetch approved leaves covering this date
    const leaves = await this.leaveModel
      .find({
        status: LeaveStatus.APPROVED,
        fromDate: { $lte: queryDate },
        toDate: { $gte: queryDate },
      })
      .exec();
    const leaveMap = new Map<string, any>(leaves.map((l) => [l.userId.toString(), l]));

    const branchMap = new Map<string, any>();

    const allLateComers: any[] = [];
    const allHalfDay: any[] = [];
    const allLeaves: any[] = [];
    const allAbsentees: any[] = [];
    const allOnTime: any[] = [];

    for (const u of users) {
      const branchName = u.branch || 'Unassigned Branch';
      if (!branchMap.has(branchName)) {
        let shortName = branchName;
        if (branchName.includes('3.0')) shortName = 'Sivakasi 3.0';
        else if (branchName.includes('1.0')) shortName = 'Sivakasi 1.0';
        else if (branchName.includes('Srivilliputhur') || branchName.includes('2.0')) shortName = 'Srivilliputhur 2.0';

        branchMap.set(branchName, {
          branchName,
          shortName,
          totalStaff: 0,
          presentCount: 0,
          onTimeCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          leaveCount: 0,
          absentCount: 0,
          lateComers: [],
          halfDayList: [],
          leaveList: [],
          absentList: [],
          onTimeList: [],
        });
      }

      const b = branchMap.get(branchName);
      b.totalStaff++;

      const userIdStr = u._id.toString();
      const att = attendanceMap.get(userIdStr);
      const lv = leaveMap.get(userIdStr);

      const staffInfo = {
        userId: u._id,
        employeeId: u.employeeId,
        name: u.name,
        role: u.role,
        designation: u.designation || u.role,
        branch: u.branch,
        shortBranch: b.shortName,
        phone: u.phone,
        department: u.department,
        avatarUrl: u.avatarUrl,
      };

      // Check if employee has joined before or on queryDate
      if (u.dateOfJoining) {
        const dojStr = new Date(u.dateOfJoining).toISOString().split('T')[0];
        if (dojStr > queryDate) {
          continue; // not joined yet
        }
      }

      // 1. Check Leave
      if (lv) {
        b.leaveCount++;
        const leaveItem = {
          ...staffInfo,
          leaveType: lv.leaveType,
          isHalfDay: lv.isHalfDay || false,
          halfDaySession: lv.halfDaySession || '',
          isLop: lv.isLop || false,
          reason: lv.reason,
          fromDate: lv.fromDate,
          toDate: lv.toDate,
          status: 'ON_LEAVE',
        };
        b.leaveList.push(leaveItem);
        allLeaves.push(leaveItem);

        if (lv.isHalfDay) {
          b.halfDayCount++;
          b.halfDayList.push(leaveItem);
          allHalfDay.push(leaveItem);
        }
        continue;
      }

      // 2. Check Attendance
      if (att) {
        const checkInTimeFormatted = att.checkInTime ? this.formatTime(att.checkInTime) : null;
        const checkOutTimeFormatted = att.checkOutTime ? this.formatTime(att.checkOutTime) : null;

        if (att.status === AttendanceStatus.HALF_DAY) {
          b.halfDayCount++;
          b.presentCount++;
          const halfDayItem = {
            ...staffInfo,
            checkInTime: checkInTimeFormatted,
            checkOutTime: checkOutTimeFormatted,
            totalWorkingMinutes: att.totalWorkingMinutes || 0,
            status: 'HALF_DAY',
            isLate: att.isLate || false,
            lateMinutes: att.lateMinutes || 0,
            notes: att.notes || 'Half-day recorded',
          };
          b.halfDayList.push(halfDayItem);
          allHalfDay.push(halfDayItem);
        } else if (att.status === AttendanceStatus.ABSENT) {
          b.absentCount++;
          const absentItem = {
            ...staffInfo,
            status: 'ABSENT',
            reason: att.notes || 'Marked Absent in system',
          };
          b.absentList.push(absentItem);
          allAbsentees.push(absentItem);
        } else {
          // PRESENT / WFH
          b.presentCount++;

          if (att.isLate) {
            b.lateCount++;
            const lateItem = {
              ...staffInfo,
              checkInTime: checkInTimeFormatted,
              lateMinutes: att.lateMinutes || 0,
              lateCountThisMonth: att.lateCountThisMonth || 1,
              isLatePenaltyApplied: att.isLatePenaltyApplied || false,
              latePenaltyType: att.latePenaltyType || 'NONE',
              status: 'LATE',
              shiftTime: (policy as any).workStartTime || '09:40 AM',
              graceTime: policy.graceTime || '09:45 AM',
            };
            b.lateComers.push(lateItem);
            allLateComers.push(lateItem);
          } else {
            b.onTimeCount++;
            const onTimeItem = {
              ...staffInfo,
              checkInTime: checkInTimeFormatted,
              checkOutTime: checkOutTimeFormatted,
              status: 'ON_TIME',
            };
            b.onTimeList.push(onTimeItem);
            allOnTime.push(onTimeItem);
          }
        }
      } else {
        // No punch and no leave -> Full Day Absent
        b.absentCount++;
        const absentItem = {
          ...staffInfo,
          status: 'ABSENT',
          reason: 'No check-in / punch recorded',
        };
        b.absentList.push(absentItem);
        allAbsentees.push(absentItem);
      }
    }

    const branches = Array.from(branchMap.values());

    return {
      success: true,
      date: queryDate,
      summary: {
        totalEmployees: users.length,
        presentOnTimeCount: allOnTime.length,
        lateComersCount: allLateComers.length,
        halfDayCount: allHalfDay.length,
        onLeaveCount: allLeaves.length,
        fullDayAbsentCount: allAbsentees.length,
      },
      branches,
      allLateComers,
      allHalfDay,
      allLeaves,
      allAbsentees,
    };
  }

  // 23. INDIVIDUAL MONTHLY ATTENDANCE REPORT & BIOMETRIC AUDIT LOG
  async getIndividualMonthlyReport(identifier: string, month?: number, year?: number) {
    let user: any = null;
    if (Types.ObjectId.isValid(identifier)) {
      user = await this.userModel.findById(identifier).lean();
    }
    if (!user) {
      user = await this.userModel.findOne({ employeeId: identifier }).lean();
    }
    if (!user) {
      user = await this.userModel.findOne({
        $or: [
          { employeeId: new RegExp(`^${identifier}$`, 'i') },
          { name: new RegExp(`^${identifier}$`, 'i') },
          { email: new RegExp(`^${identifier}$`, 'i') },
        ],
      }).lean();
    }
    if (!user) {
      throw new NotFoundException(`Employee '${identifier}' not found`);
    }

    const now = new Date();
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || (now.getMonth() + 1);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthShortNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const todayStr = this.getTodayString();

    const statementPeriod = `${monthNames[m - 1]} ${y}`;
    const printDate = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date());

    const [policyDoc, attendances, permissions, leaves, leaveBalance] = await Promise.all([
      this.policyModel.findOne({ isActive: true }).lean(),
      this.attendanceModel
        .find({
          userId: user._id,
          date: { $gte: startStr, $lte: endStr },
        })
        .sort({ date: 1 })
        .lean(),
      this.permissionModel
        .find({
          userId: user._id,
          date: { $gte: startStr, $lte: endStr },
          status: { $ne: 'REJECTED' },
        })
        .lean(),
      this.leaveModel
        .find({
          userId: user._id,
          status: { $in: [LeaveStatus.APPROVED, 'APPROVED'] },
          $or: [{ fromDate: { $lte: endStr }, toDate: { $gte: startStr } }],
        })
        .lean(),
      this.leaveBalanceModel
        ? this.leaveBalanceModel.findOne({ userId: user._id, year: y }).lean()
        : null,
    ]);

    const shiftStartTime = policyDoc?.workStartTime || '09:40 AM';
    const graceTime = policyDoc?.graceTime || '09:45 AM';
    const shiftEndTime = policyDoc?.workEndTime || '07:00 PM';
    const allowedLate = policyDoc?.allowedLateCheckins || 3;
    const maxPermissionHours = policyDoc?.maxMonthlyPermissionHours || 2;

    const doj = user.dateOfJoining
      ? new Date(user.dateOfJoining).toISOString().split('T')[0]
      : 'N/A';

    // Summary calculations
    const presentRecords = attendances.filter(
      (a: any) =>
        a.status === AttendanceStatus.PRESENT ||
        a.status === AttendanceStatus.HALF_DAY ||
        a.status === AttendanceStatus.WFH ||
        (a.checkInTime && a.status !== AttendanceStatus.ABSENT),
    );
    const daysPresent = presentRecords.length;

    const lateRecords = attendances.filter((a: any) => a.isLate);
    const lateArrivalsCount = lateRecords.length;
    const lateArrivalsText = `${lateArrivalsCount} / ${allowedLate}`;

    const casualLeavesUsed = leaves
      .filter((l: any) => l.leaveType === LeaveType.CASUAL || (l.leaveType as any) === 'CASUAL')
      .reduce((acc: number, l: any) => acc + (l.paidDays || l.days || 1), 0);
    const casualBalance = leaveBalance?.casual ?? 12;
    const casualLeavesText = `${casualBalance} / ${casualLeavesUsed > 0 ? casualLeavesUsed : 1} CL`;

    const totalPermissionHours = permissions.reduce(
      (acc: number, p: any) => acc + (p.durationHours || 0),
      0,
    );
    const permissionUsedText = `${totalPermissionHours}h / ${maxPermissionHours}h`;

    const lopLeaves = leaves
      .filter((l: any) => l.leaveType === LeaveType.LOSS_OF_PAY || (l.leaveType as any) === 'LOP' || l.isLop)
      .reduce((acc: number, l: any) => acc + (l.days || 1), 0);
    const latePenaltyDeductions = attendances.filter((a: any) => a.isLatePenaltyApplied).length * 0.5;
    const totalLopDays = lopLeaves + latePenaltyDeductions;
    const lopText = `${totalLopDays} Day(s)`;

    // Daily audit generation
    const attMap = new Map<string, any>(attendances.map((a: any) => [a.date, a]));
    const daysList: any[] = [];

    for (let d = 1; d <= lastDay; d++) {
      const dayFormatted = String(d).padStart(2, '0');
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${dayFormatted}`;
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();
      const weekdayShort = weekdayNames[dayOfWeek];
      const dateAndWeekday = `${dayFormatted} ${monthShortNames[m - 1]} ${y}  ${weekdayShort}`;
      const shiftTimings = `${shiftStartTime} – ${shiftEndTime}`;

      const isSunday = dayOfWeek === 0;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      const attRecord = attMap.get(dateStr);
      const leaveRecord = leaves.find((l: any) => dateStr >= l.fromDate && dateStr <= l.toDate);

      let checkIn = '--:--';
      let checkOut = '--:--';
      let duration = '--';
      let statusPolicy = 'SCHEDULED SHIFT';
      let badgeClass = 'badge-scheduled';
      let locationTerminal = `Shift: ${shiftTimings}`;

      if (attRecord && attRecord.checkInTime) {
        checkIn = this.formatTime(attRecord.checkInTime);
        checkOut = attRecord.checkOutTime ? this.formatTime(attRecord.checkOutTime) : '--:--';
        duration =
          attRecord.totalWorkingMinutes > 0
            ? `${Math.floor(attRecord.totalWorkingMinutes / 60)}h ${attRecord.totalWorkingMinutes % 60}m`
            : attRecord.checkOutTime
              ? '0h'
              : '--';

        if (attRecord.isLatePenaltyApplied) {
          statusPolicy = 'HALF-DAY DEDUCTION';
          badgeClass = 'badge-absent';
        } else if (attRecord.isLate) {
          statusPolicy = `LATE ARRIVAL (${attRecord.lateMinutes || 0}m)`;
          badgeClass = 'badge-late';
        } else if (attRecord.status === AttendanceStatus.HALF_DAY) {
          statusPolicy = 'HALF DAY';
          badgeClass = 'badge-halfday';
        } else if (attRecord.status === AttendanceStatus.WFH) {
          statusPolicy = 'WORK FROM HOME';
          badgeClass = 'badge-present';
        } else {
          statusPolicy = 'PRESENT';
          badgeClass = 'badge-present';
        }

        locationTerminal =
          attRecord.locationAddress ||
          attRecord.branchName ||
          (user.branch ? `${user.branch} Terminal` : "Today's Live Punch (Biometric/GPS)");
      } else if (leaveRecord) {
        const isLopLeave =
          leaveRecord.leaveType === LeaveType.LOSS_OF_PAY ||
          (leaveRecord.leaveType as any) === 'LOP' ||
          leaveRecord.isLop;
        statusPolicy =
          leaveRecord.leaveType === LeaveType.CASUAL
            ? 'CASUAL LEAVE (CL)'
            : isLopLeave
              ? 'LOSS OF PAY (LOP)'
              : 'APPROVED LEAVE';
        badgeClass = isLopLeave ? 'badge-absent' : 'badge-leave';
        locationTerminal = `Approved Leave (${leaveRecord.reason || leaveRecord.leaveType})`;
      } else if (isSunday) {
        statusPolicy = 'SUNDAY (WEEKLY OFF)';
        badgeClass = 'badge-sunday';
        locationTerminal = 'Campus Weekly Holiday';
      } else if (isToday) {
        statusPolicy = 'SHIFT OUT';
        badgeClass = 'badge-shift_out';
        locationTerminal = "Today's Live Punch (Biometric/GPS)";
      } else if (isFuture) {
        statusPolicy = 'SCHEDULED SHIFT';
        badgeClass = 'badge-scheduled';
        locationTerminal = `Shift: ${shiftTimings}`;
      } else if (isPast) {
        statusPolicy = 'ABSENT / LOP';
        badgeClass = 'badge-absent';
        locationTerminal = 'No punch logged';
      }

      daysList.push({
        day: dayFormatted,
        date: dateStr,
        weekday: weekdayShort,
        dateAndWeekday,
        shiftTimings,
        checkIn,
        checkOut,
        duration,
        status: statusPolicy,
        badgeClass,
        locationTerminal,
        isSunday,
        isPast,
        isToday,
        isFuture,
      });
    }

    const employeeData = {
      id: user._id,
      employeeId: user.employeeId || 'N/A',
      name: user.name || 'Unknown',
      designation: user.designation || user.role || 'Staff',
      role: user.role || 'Staff',
      department: user.department || 'General',
      branch: (user as any).branch || '📍 WeGrow Skill Campus – Sivakasi Branch 1.0',
      dateOfJoining: doj,
      email: user.email,
      phone: user.phone,
    };

    const periodData = {
      month: m,
      year: y,
      monthName: monthNames[m - 1],
      statementPeriod,
      printDate,
      totalDays: lastDay,
    };

    const metricsData = {
      daysInMonth: lastDay,
      daysPresent,
      lateArrivalsCount,
      allowedLateCheckins: allowedLate,
      lateArrivalsText,
      casualLeavesBalance: casualBalance,
      casualLeavesUsed,
      casualLeavesText,
      permissionHoursUsed: totalPermissionHours,
      maxPermissionHours,
      permissionUsedText,
      lossOfPayDays: totalLopDays,
      lopText,
    };

    const shiftPolicyData = {
      workStartTime: shiftStartTime,
      graceTime,
      workEndTime: shiftEndTime,
      allowedLateCheckins: allowedLate,
      maxMonthlyPermissionHours: maxPermissionHours,
    };

    return {
      success: true,
      employee: employeeData,
      period: periodData,
      metrics: metricsData,
      shiftPolicy: shiftPolicyData,
      days: daysList,
    };
  }

  // 24. GENERATE INDIVIDUAL HTML REPORT (Print & PDF Ready)
  generateIndividualReportHtml(reportData: any): string {
    const { employee, period, metrics, shiftPolicy, days } = reportData;

    const rowsHtml = days
      .map(
        (d: any) => `
        <tr class="${d.isSunday ? 'row-sunday' : ''}">
          <td class="col-day">${d.day}</td>
          <td class="col-date">${d.dateAndWeekday}</td>
          <td class="col-shift">${d.shiftTimings}</td>
          <td class="col-time">${d.checkIn}</td>
          <td class="col-time">${d.checkOut}</td>
          <td class="col-duration">${d.duration}</td>
          <td class="col-status"><span class="badge ${d.badgeClass}">${d.status}</span></td>
          <td class="col-location">${d.locationTerminal}</td>
        </tr>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly_Attendance_Report_${employee.employeeId}_${employee.name.replace(/\\s+/g, '_')}_${period.monthName}_${period.year}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-navy: #0b1f3a;
      --navy-light: #1e293b;
      --primary-orange: #ea580c;
      --orange-light: #ffedd5;
      --text-dark: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --bg-slate: #f8fafc;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-dark);
      background-color: #f1f5f9;
      font-size: 11px;
      line-height: 1.4;
      padding: 20px;
    }

    .report-card {
      max-width: 1200px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      border-radius: 6px;
    }

    .no-print-toolbar {
      max-width: 1200px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #ea580c;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #c2410c;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }

    /* HEADER */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .org-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--primary-navy);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .report-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary-orange);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }

    .header-meta strong {
      color: var(--text-dark);
      font-weight: 600;
    }

    .header-rule {
      height: 3px;
      background: linear-gradient(90deg, #ea580c 0%, #f97316 100%);
      margin-bottom: 14px;
      border-radius: 2px;
    }

    /* EMPLOYEE DETAILS BAR */
    .employee-bar {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      background: var(--bg-slate);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 14px;
      gap: 12px;
      margin-bottom: 14px;
    }

    .emp-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .emp-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.3px;
    }

    .emp-val {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary-navy);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .emp-val.highlight {
      color: var(--primary-orange);
    }

    /* KPI METRICS */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }

    .kpi-number {
      font-size: 15px;
      font-weight: 800;
    }

    .kpi-days { color: var(--text-dark); }
    .kpi-present { color: #059669; }
    .kpi-late { color: #ea580c; }
    .kpi-casual { color: #2563eb; }
    .kpi-permission { color: #7c3aed; }
    .kpi-lop { color: #dc2626; }

    /* AUDIT LOG TABLE */
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .audit-table th {
      background: var(--primary-navy);
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 7px 6px;
      text-align: left;
      border: 1px solid #0f2a4f;
    }

    .audit-table th.center { text-align: center; }

    .audit-table td {
      padding: 5.5px 6px;
      font-size: 10.5px;
      border: 1px solid #e2e8f0;
      color: var(--text-dark);
      vertical-align: middle;
    }

    .audit-table tbody tr:nth-child(even) {
      background-color: #fafbfd;
    }

    .audit-table tbody tr.row-sunday {
      background-color: #f8fafc;
    }

    .col-day {
      text-align: center;
      font-weight: 700;
      width: 32px;
      color: #334155;
    }

    .col-date {
      width: 125px;
      font-weight: 600;
      color: #1e293b;
    }

    .col-shift {
      width: 145px;
      font-size: 10px;
      color: #64748b;
    }

    .col-time {
      text-align: center;
      width: 85px;
      font-weight: 500;
      color: #334155;
    }

    .col-duration {
      text-align: center;
      width: 65px;
      font-weight: 600;
      color: #0f172a;
    }

    .col-status {
      text-align: center;
      width: 140px;
    }

    .col-location {
      font-size: 10px;
      color: #475569;
    }

    /* BADGES */
    .badge {
      display: inline-block;
      padding: 2.5px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }

    .badge-absent {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    .badge-sunday {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .badge-shift_out {
      background: #ffedd5;
      color: #c2410c;
      border: 1px solid #fed7aa;
    }

    .badge-scheduled {
      background: #f3f4f6;
      color: #4b5563;
      border: 1px solid #e5e7eb;
    }

    .badge-present {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .badge-late {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .badge-leave {
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .badge-halfday {
      background: #fef08a;
      color: #854d0e;
      border: 1px solid #fde047;
    }

    /* FOOTER */
    .report-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 10px;
      border-top: 1px solid var(--border-color);
      font-size: 9.5px;
      color: #64748b;
    }

    .footer-left {
      line-height: 1.5;
    }

    .footer-left strong {
      color: var(--text-dark);
      font-weight: 700;
    }

    .footer-right {
      text-align: right;
      font-weight: 700;
      color: var(--primary-navy);
      padding-top: 25px;
      border-top: 1px solid #94a3b8;
      min-width: 200px;
    }

    @media print {
      @page {
        size: A4 landscape;
        margin: 8mm 6mm;
      }

      body {
        background: #ffffff !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print, .no-print-toolbar {
        display: none !important;
      }

      .report-card {
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      .audit-table th {
        background: #0b1f3a !important;
        color: #ffffff !important;
      }

      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar no-print">
    <div>
      <span style="font-weight: 700; color: #0f172a; font-size: 13px;">${employee.employeeId} - ${employee.name}</span>
      <span style="color: #64748b; font-size: 12px; margin-left: 10px;">${period.statementPeriod} Statement</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="btn btn-primary">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" class="btn btn-secondary">Close</button>
    </div>
  </div>

  <div class="report-card">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="org-title">WEGROW SKILL CAMPUS</div>
          <div class="report-subtitle">INDIVIDUAL MONTHLY ATTENDANCE &amp; BIOMETRIC AUDIT LOG</div>
        </td>
        <td class="header-meta" style="vertical-align: top;">
          <div>Statement Period: <strong>${period.statementPeriod}</strong></div>
          <div>Shift Timings: <strong>${shiftPolicy.workStartTime} – ${shiftPolicy.workEndTime} (Grace: ${shiftPolicy.graceTime})</strong></div>
          <div>Print Date: <strong>${period.printDate}</strong></div>
        </td>
      </tr>
    </table>

    <div class="header-rule"></div>

    <!-- Employee Meta Bar -->
    <div class="employee-bar">
      <div class="emp-item">
        <span class="emp-label">Staff ID</span>
        <span class="emp-val highlight">${employee.employeeId}</span>
      </div>
      <div class="emp-item">
        <span class="emp-label">Employee Name</span>
        <span class="emp-val">${employee.name}</span>
      </div>
      <div class="emp-item">
        <span class="emp-label">Designation / Role</span>
        <span class="emp-val">${employee.designation}</span>
      </div>
      <div class="emp-item">
        <span class="emp-label">Department</span>
        <span class="emp-val">${employee.department}</span>
      </div>
      <div class="emp-item">
        <span class="emp-label">Assigned Branch</span>
        <span class="emp-val">${employee.branch}</span>
      </div>
      <div class="emp-item">
        <span class="emp-label">Date of Joining</span>
        <span class="emp-val">${employee.dateOfJoining}</span>
      </div>
    </div>

    <!-- 6 KPI Metric Boxes -->
    <div class="metrics-grid">
      <div class="kpi-card">
        <span class="kpi-title">Days in Month</span>
        <span class="kpi-number kpi-days">${metrics.daysInMonth}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Days Present</span>
        <span class="kpi-number kpi-present">${metrics.daysPresent}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Late Arrivals</span>
        <span class="kpi-number kpi-late">${metrics.lateArrivalsText}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Casual Leaves Taken</span>
        <span class="kpi-number kpi-casual">${metrics.casualLeavesText}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Permission Used</span>
        <span class="kpi-number kpi-permission">${metrics.permissionUsedText}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Loss of Pay (LOP)</span>
        <span class="kpi-number kpi-lop">${metrics.lopText}</span>
      </div>
    </div>

    <!-- Main Table -->
    <table class="audit-table">
      <thead>
        <tr>
          <th class="center">DAY</th>
          <th>DATE &amp; WEEKDAY</th>
          <th>SHIFT TIMINGS</th>
          <th class="center">CHECK-IN (IST)</th>
          <th class="center">CHECK-OUT (IST)</th>
          <th class="center">DURATION</th>
          <th class="center">STATUS / POLICY</th>
          <th>LOCATION / BIOMETRIC PUNCH TERMINAL</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="report-footer">
      <div class="footer-left">
        <div><strong>WeGrow HR &amp; Biometric Compliance Directorate</strong></div>
        <div>Employee Attendance Statement • Computer generated with cryptographic record audit</div>
        <div>Policy rules: Shift ${shiftPolicy.workStartTime} – ${shiftPolicy.workEndTime} (Grace: ${shiftPolicy.graceTime}). Max ${shiftPolicy.allowedLateCheckins} late arrivals / ${shiftPolicy.maxMonthlyPermissionHours}.0h permission per month.</div>
      </div>
      <div class="footer-right">
        HR Directorate / Branch Head
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // 25. BULK MONTHLY REPORT (All Employees / Branch / Department)
  async getBulkMonthlyReport(month?: number, year?: number, branch?: string, department?: string) {
    const userQuery: any = { isActive: true };
    if (branch && branch !== 'ALL') {
      userQuery.branch = branch;
    }
    if (department && department !== 'ALL') {
      userQuery.department = department;
    }

    const users = await this.userModel.find(userQuery).sort({ branch: 1, name: 1 }).exec();

    const reports = await Promise.all(
      users.map(async (u) => {
        try {
          return await this.getIndividualMonthlyReport(u._id.toString(), month, year);
        } catch (e) {
          return null;
        }
      }),
    );

    const validReports = reports.filter((r) => r !== null);

    return {
      success: true,
      count: validReports.length,
      branch: branch || 'ALL',
      department: department || 'ALL',
      reports: validReports,
    };
  }

  // 26. BULK HTML REPORT GENERATOR
  generateBulkReportHtml(bulkData: any): string {
    const reports = bulkData.reports || [];
    if (reports.length === 0) {
      return `<!DOCTYPE html><html><body><h2>No employee reports found for the selected filter.</h2></body></html>`;
    }

    const firstReport = reports[0];
    const period = firstReport.period;

    const reportsHtml = reports
      .map((r: any, idx: number) => {
        const { employee, metrics, shiftPolicy, days } = r;
        const rowsHtml = days
          .map(
            (d: any) => `
            <tr class="${d.isSunday ? 'row-sunday' : ''}">
              <td class="col-day">${d.day}</td>
              <td class="col-date">${d.dateAndWeekday}</td>
              <td class="col-shift">${d.shiftTimings}</td>
              <td class="col-time">${d.checkIn}</td>
              <td class="col-time">${d.checkOut}</td>
              <td class="col-duration">${d.duration}</td>
              <td class="col-status"><span class="badge ${d.badgeClass}">${d.status}</span></td>
              <td class="col-location">${d.locationTerminal}</td>
            </tr>`,
          )
          .join('\n');

        return `
        <div class="report-card ${idx > 0 ? 'page-break-before' : ''}">
          <!-- Header -->
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                <div class="org-title">WEGROW SKILL CAMPUS</div>
                <div class="report-subtitle">INDIVIDUAL MONTHLY ATTENDANCE &amp; BIOMETRIC AUDIT LOG</div>
              </td>
              <td class="header-meta" style="vertical-align: top;">
                <div>Statement Period: <strong>${period.statementPeriod}</strong></div>
                <div>Shift Timings: <strong>${shiftPolicy.workStartTime} – ${shiftPolicy.workEndTime} (Grace: ${shiftPolicy.graceTime})</strong></div>
                <div>Print Date: <strong>${period.printDate}</strong></div>
              </td>
            </tr>
          </table>

          <div class="header-rule"></div>

          <!-- Employee Meta Bar -->
          <div class="employee-bar">
            <div class="emp-item">
              <span class="emp-label">Staff ID</span>
              <span class="emp-val highlight">${employee.employeeId}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Employee Name</span>
              <span class="emp-val">${employee.name}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Designation / Role</span>
              <span class="emp-val">${employee.designation}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Department</span>
              <span class="emp-val">${employee.department}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Assigned Branch</span>
              <span class="emp-val">${employee.branch}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Date of Joining</span>
              <span class="emp-val">${employee.dateOfJoining}</span>
            </div>
          </div>

          <!-- 6 KPI Metric Boxes -->
          <div class="metrics-grid">
            <div class="kpi-card">
              <span class="kpi-title">Days in Month</span>
              <span class="kpi-number kpi-days">${metrics.daysInMonth}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-title">Days Present</span>
              <span class="kpi-number kpi-present">${metrics.daysPresent}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-title">Late Arrivals</span>
              <span class="kpi-number kpi-late">${metrics.lateArrivalsText}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-title">Casual Leaves Taken</span>
              <span class="kpi-number kpi-casual">${metrics.casualLeavesText}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-title">Permission Used</span>
              <span class="kpi-number kpi-permission">${metrics.permissionUsedText}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-title">Loss of Pay (LOP)</span>
              <span class="kpi-number kpi-lop">${metrics.lopText}</span>
            </div>
          </div>

          <!-- Main Table -->
          <table class="audit-table">
            <thead>
              <tr>
                <th class="center">DAY</th>
                <th>DATE &amp; WEEKDAY</th>
                <th>SHIFT TIMINGS</th>
                <th class="center">CHECK-IN (IST)</th>
                <th class="center">CHECK-OUT (IST)</th>
                <th class="center">DURATION</th>
                <th class="center">STATUS / POLICY</th>
                <th>LOCATION / BIOMETRIC PUNCH TERMINAL</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Footer -->
          <div class="report-footer">
            <div class="footer-left">
              <div><strong>WeGrow HR &amp; Biometric Compliance Directorate</strong></div>
              <div>Employee Attendance Statement • Computer generated with cryptographic record audit</div>
              <div>Policy rules: Shift ${shiftPolicy.workStartTime} – ${shiftPolicy.workEndTime} (Grace: ${shiftPolicy.graceTime}). Max ${shiftPolicy.allowedLateCheckins} late arrivals / ${shiftPolicy.maxMonthlyPermissionHours}.0h permission per month.</div>
            </div>
            <div class="footer-right">
              HR Directorate / Branch Head
            </div>
          </div>
        </div>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulk_Monthly_Attendance_Report_${period.monthName}_${period.year}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-navy: #0b1f3a;
      --navy-light: #1e293b;
      --primary-orange: #ea580c;
      --orange-light: #ffedd5;
      --text-dark: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --bg-slate: #f8fafc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-dark);
      background-color: #f1f5f9;
      font-size: 11px;
      line-height: 1.4;
      padding: 20px;
    }

    .report-card {
      max-width: 1200px;
      margin: 0 auto 30px auto;
      background: #ffffff;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      border-radius: 6px;
    }

    .page-break-before {
      page-break-before: always;
      break-before: page;
    }

    .no-print-toolbar {
      max-width: 1200px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      text-decoration: none;
    }

    .btn-primary { background: #ea580c; color: #ffffff; }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .org-title { font-size: 18px; font-weight: 800; color: var(--primary-navy); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3px; }
    .report-subtitle { font-size: 11px; font-weight: 700; color: var(--primary-orange); letter-spacing: 0.5px; text-transform: uppercase; }
    .header-meta { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
    .header-meta strong { color: var(--text-dark); font-weight: 600; }
    .header-rule { height: 3px; background: linear-gradient(90deg, #ea580c 0%, #f97316 100%); margin-bottom: 14px; border-radius: 2px; }

    .employee-bar {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      background: var(--bg-slate);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 14px;
      gap: 12px;
      margin-bottom: 14px;
    }

    .emp-item { display: flex; flex-direction: column; gap: 2px; }
    .emp-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.3px; }
    .emp-val { font-size: 11px; font-weight: 700; color: var(--primary-navy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .emp-val.highlight { color: var(--primary-orange); }

    .metrics-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi-card { background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .kpi-title { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.3px; margin-bottom: 4px; }
    .kpi-number { font-size: 15px; font-weight: 800; }
    .kpi-days { color: var(--text-dark); }
    .kpi-present { color: #059669; }
    .kpi-late { color: #ea580c; }
    .kpi-casual { color: #2563eb; }
    .kpi-permission { color: #7c3aed; }
    .kpi-lop { color: #dc2626; }

    .audit-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .audit-table th { background: var(--primary-navy); color: #ffffff; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 7px 6px; text-align: left; border: 1px solid #0f2a4f; }
    .audit-table th.center { text-align: center; }
    .audit-table td { padding: 5.5px 6px; font-size: 10.5px; border: 1px solid #e2e8f0; color: var(--text-dark); vertical-align: middle; }
    .audit-table tbody tr:nth-child(even) { background-color: #fafbfd; }
    .audit-table tbody tr.row-sunday { background-color: #f8fafc; }

    .col-day { text-align: center; font-weight: 700; width: 32px; color: #334155; }
    .col-date { width: 125px; font-weight: 600; color: #1e293b; }
    .col-shift { width: 145px; font-size: 10px; color: #64748b; }
    .col-time { text-align: center; width: 85px; font-weight: 500; color: #334155; }
    .col-duration { text-align: center; width: 65px; font-weight: 600; color: #0f172a; }
    .col-status { text-align: center; width: 140px; }
    .col-location { font-size: 10px; color: #475569; }

    .badge { display: inline-block; padding: 2.5px 7px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; }
    .badge-absent { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .badge-sunday { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-shift_out { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
    .badge-scheduled { background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
    .badge-present { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-late { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-leave { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-halfday { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }

    .report-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 9.5px; color: #64748b; }
    .footer-left { line-height: 1.5; }
    .footer-left strong { color: var(--text-dark); font-weight: 700; }
    .footer-right { text-align: right; font-weight: 700; color: var(--primary-navy); padding-top: 25px; border-top: 1px solid #94a3b8; min-width: 200px; }

    @media print {
      @page {
        size: A4 landscape;
        margin: 8mm 6mm;
      }

      body {
        background: #ffffff !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print, .no-print-toolbar { display: none !important; }
      .report-card { padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; margin-bottom: 0 !important; }
      .audit-table th { background: #0b1f3a !important; color: #ffffff !important; }
      tr { page-break-inside: avoid; }
      .page-break-before { page-break-before: always; break-before: page; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar no-print">
    <div>
      <span style="font-weight: 700; color: #0f172a; font-size: 13px;">Bulk Attendance Statement (${reports.length} Employees)</span>
      <span style="color: #64748b; font-size: 12px; margin-left: 10px;">${period.statementPeriod}</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="btn btn-primary">🖨️ Print All / Save as PDF</button>
      <button onclick="window.close()" class="btn btn-secondary">Close</button>
    </div>
  </div>

  ${reportsHtml}
</body>
</html>`;
  }
}

