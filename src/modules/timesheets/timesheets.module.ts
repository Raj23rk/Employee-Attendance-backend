import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Timesheet, TimesheetSchema } from './schemas/timesheet.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Timesheet.name, schema: TimesheetSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService, MongooseModule],
})
export class TimesheetsModule {}
