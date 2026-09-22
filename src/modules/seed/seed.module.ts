import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LeaveBalance, LeaveBalanceSchema } from '../leaves/schemas/leave-balance.schema';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from '../notifications/schemas/notification-template.schema';
import { Department, DepartmentSchema } from '../organization/schemas/department.schema';
import { Holiday, HolidaySchema } from '../dashboard/schemas/holiday.schema';
import {
  AttendancePolicy,
  AttendancePolicySchema,
} from '../attendance/schemas/attendance-policy.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Holiday.name, schema: HolidaySchema },
      { name: AttendancePolicy.name, schema: AttendancePolicySchema },
      { name: Attendance.name, schema: AttendanceSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
