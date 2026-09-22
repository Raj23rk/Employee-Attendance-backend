import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';
import { Event, EventSchema } from './schemas/event.schema';
import { TravelRequest, TravelRequestSchema } from './schemas/travel-request.schema';
import { EngageService } from './engage.service';
import { EngageController } from './engage.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: Event.name, schema: EventSchema },
      { name: TravelRequest.name, schema: TravelRequestSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [EngageController],
  providers: [EngageService],
  exports: [EngageService, MongooseModule],
})
export class EngageModule {}
