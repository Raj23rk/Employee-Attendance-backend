import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Announcement, AnnouncementDocument } from './schemas/announcement.schema';
import { Event, EventDocument } from './schemas/event.schema';
import { TravelRequest, TravelRequestDocument } from './schemas/travel-request.schema';
import {
  CreateAnnouncementDto,
  CreateEventDto,
  CreateTravelRequestDto,
} from './dto/engage.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EngageService {
  constructor(
    @InjectModel(Announcement.name)
    private announcementModel: Model<AnnouncementDocument>,
    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,
    @InjectModel(TravelRequest.name)
    private travelModel: Model<TravelRequestDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // 1. Get Announcements
  async getAnnouncements() {
    const list = await this.announcementModel
      .find({ isPublished: true })
      .populate('authorId', 'name designation avatarUrl')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  // 2. Post Announcement (HR, CEO)
  async createAnnouncement(authorId: string, dto: CreateAnnouncementDto) {
    const created = await this.announcementModel.create({
      ...dto,
      authorId: new Types.ObjectId(authorId),
    });

    return { success: true, message: 'Announcement published', data: created };
  }

  // 3. Like/Unlike Announcement
  async toggleLike(announcementId: string, userId: string) {
    const announcement = await this.announcementModel.findById(announcementId);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const uId = new Types.ObjectId(userId);
    const existingIndex = announcement.likes.findIndex((id) => id.toString() === userId);

    if (existingIndex > -1) {
      announcement.likes.splice(existingIndex, 1);
    } else {
      announcement.likes.push(uId);
    }

    await announcement.save();
    return {
      success: true,
      liked: existingIndex === -1,
      totalLikes: announcement.likes.length,
    };
  }

  // 4. Get Events
  async getEvents() {
    const list = await this.eventModel
      .find({ isActive: true })
      .sort({ eventDate: 1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  // 5. RSVP / Volunteer Event
  async toggleRsvp(eventId: string, userId: string) {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const uId = new Types.ObjectId(userId);
    const index = event.rsvps.findIndex((id) => id.toString() === userId);

    if (index > -1) {
      event.rsvps.splice(index, 1);
    } else {
      event.rsvps.push(uId);
    }

    await event.save();
    return {
      success: true,
      rsvpd: index === -1,
      totalRsvps: event.rsvps.length,
    };
  }

  // 6. Travel Request
  async createTravelRequest(userId: string, dto: CreateTravelRequestDto) {
    const travel = await this.travelModel.create({
      ...dto,
      userId: new Types.ObjectId(userId),
      status: 'PENDING',
    });

    return { success: true, message: 'Travel booking request submitted', data: travel };
  }
}
