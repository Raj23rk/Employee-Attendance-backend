import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveSchema } from '../leaves/schemas/leave.schema';
import { LeaveBalance, LeaveBalanceSchema } from '../leaves/schemas/leave-balance.schema';
import {
  CelebrationWish,
  CelebrationWishSchema,
} from './schemas/celebration-wish.schema';
import { Holiday, HolidaySchema } from './schemas/holiday.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Leave.name, schema: LeaveSchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
      { name: CelebrationWish.name, schema: CelebrationWishSchema },
      { name: Holiday.name, schema: HolidaySchema },
      { name: Task.name, schema: TaskSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService, MongooseModule],
})
export class DashboardModule {}
