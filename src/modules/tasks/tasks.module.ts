import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService, MongooseModule],
})
export class TasksModule {}

