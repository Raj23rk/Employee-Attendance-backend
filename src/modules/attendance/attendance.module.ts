import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import {
  AttendanceCorrection,
  AttendanceCorrectionSchema,
} from './schemas/attendance-correction.schema';
import {
  AttendancePolicy,
  AttendancePolicySchema,
} from './schemas/attendance-policy.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: AttendanceCorrection.name, schema: AttendanceCorrectionSchema },
      { name: AttendancePolicy.name, schema: AttendancePolicySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, MongooseModule],
})
export class AttendanceModule {}
