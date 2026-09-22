import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Timesheet, TimesheetDocument } from './schemas/timesheet.schema';
import { SubmitTimesheetDto, ReviewTimesheetDto } from './dto/timesheet.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TimesheetsService {
  constructor(
    @InjectModel(Timesheet.name) private timesheetModel: Model<TimesheetDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async getWeeklyTimesheet(userId: string, weekStartDate: string) {
    const timesheet = await this.timesheetModel.findOne({
      userId: new Types.ObjectId(userId),
      weekStartDate,
    });

    if (!timesheet) {
      return {
        success: true,
        data: {
          weekStartDate,
          rows: [],
          totalHours: 0,
          status: 'NOT_STARTED',
        },
      };
    }

    return { success: true, data: timesheet };
  }

  async submitTimesheet(userId: string, dto: SubmitTimesheetDto) {
    let total = 0;
    const computedRows = dto.rows.map((r) => {
      const rowTotal = r.entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
      total += rowTotal;
      return {
        ...r,
        totalHours: rowTotal,
      };
    });

    let timesheet = await this.timesheetModel.findOne({
      userId: new Types.ObjectId(userId),
      weekStartDate: dto.weekStartDate,
    });

    if (!timesheet) {
      timesheet = new this.timesheetModel({
        userId: new Types.ObjectId(userId),
        weekStartDate: dto.weekStartDate,
        weekEndDate: dto.weekEndDate,
        rows: computedRows,
        totalHours: total,
        status: 'SUBMITTED',
      });
    } else {
      timesheet.weekEndDate = dto.weekEndDate;
      timesheet.rows = computedRows;
      timesheet.totalHours = total;
      timesheet.status = 'SUBMITTED';
    }

    await timesheet.save();

    // Notify manager
    const employee = await this.userModel.findById(userId);
    if (employee?.managerId) {
      const manager = await this.userModel.findById(employee.managerId);
      if (manager) {
        await this.notificationsService.createInAppNotification(
          manager._id.toString(),
          'Timesheet Submitted for Review',
          `${employee.name} submitted their timesheet for week ${dto.weekStartDate} (${total} hrs).`,
          'INFO',
          '/timesheets/manager/pending',
        );
      }
    }

    return { success: true, message: 'Timesheet submitted successfully', data: timesheet };
  }

  async getTimesheetHistory(userId: string) {
    const list = await this.timesheetModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('reviewedBy', 'name email')
      .sort({ weekStartDate: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getPendingManagerTimesheets(managerId: string, role: Role) {
    let filter: any = { status: 'SUBMITTED' };

    if (role === Role.MANAGER) {
      const reportees = await this.userModel.find({ managerId: new Types.ObjectId(managerId) }).select('_id');
      const reporteeIds = reportees.map((r) => r._id);
      filter.userId = { $in: reporteeIds };
    }

    const list = await this.timesheetModel
      .find(filter)
      .populate('userId', 'name employeeId department')
      .sort({ weekStartDate: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async reviewTimesheet(id: string, reviewerId: string, dto: ReviewTimesheetDto) {
    const timesheet = await this.timesheetModel.findById(id);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    timesheet.status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    timesheet.reviewedBy = new Types.ObjectId(reviewerId);
    timesheet.remarks = dto.remarks || '';
    timesheet.reviewedAt = new Date();
    await timesheet.save();

    // Notify employee
    const employee = await this.userModel.findById(timesheet.userId);
    if (employee) {
      await this.notificationsService.createInAppNotification(
        employee._id.toString(),
        `Timesheet ${dto.action}`,
        `Your timesheet for week ${timesheet.weekStartDate} was ${dto.action.toLowerCase()}d.`,
        dto.action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        '/timesheets/history',
      );
    }

    return { success: true, message: `Timesheet ${dto.action.toLowerCase()}d successfully`, data: timesheet };
  }
}
