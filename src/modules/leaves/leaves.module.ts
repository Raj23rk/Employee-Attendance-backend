import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Leave, LeaveSchema } from './schemas/leave.schema';
import { LeaveBalance, LeaveBalanceSchema } from './schemas/leave-balance.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Leave.name, schema: LeaveSchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService, MongooseModule],
})
export class LeavesModule {}
