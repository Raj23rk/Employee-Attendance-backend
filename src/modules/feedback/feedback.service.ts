import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, FeedbackDocument } from './schemas/feedback.schema';
import { SubmitFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // 1. Submit open feedback (Any employee)
  async submitFeedback(userId: string, dto: SubmitFeedbackDto) {
    const feedback = await this.feedbackModel.create({
      title: dto.title,
      category: dto.category || 'GENERAL',
      message: dto.message,
      suggestions: dto.suggestions || '',
      submittedBy: new Types.ObjectId(userId), // Securely stored for CEO review only
      status: 'OPEN',
    });

    // Notify CEO in-app that new confidential feedback was submitted
    const ceos = await this.userModel.find({ role: Role.CEO, isActive: true });
    for (const ceo of ceos) {
      await this.notificationsService.createInAppNotification(
        ceo._id.toString(),
        'New Confidential Open Feedback',
        `A new confidential feedback "${dto.title}" has been submitted for your executive review.`,
        'INFO',
        '/feedback/executive',
      );
    }

    return {
      success: true,
      message: 'Your feedback has been confidentially submitted to the CEO.',
      data: {
        id: feedback._id,
        title: feedback.title,
        category: feedback.category,
        status: feedback.status,
        createdAt: (feedback as any).createdAt,
      },
    };
  }

  // 2. View all feedback (CEO ONLY: employee identity visible only to CEO)
  async getAllFeedbackForCeo() {
    const list = await this.feedbackModel
      .find()
      .populate('submittedBy', 'name employeeId email department designation')
      .sort({ createdAt: -1 })
      .exec();

    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  // 3. Current user view their own submissions (never reveals other employees' feedback)
  async getMySubmittedFeedback(userId: string) {
    const list = await this.feedbackModel
      .find({ submittedBy: new Types.ObjectId(userId) })
      .select('-ceoNotes')
      .sort({ createdAt: -1 })
      .exec();

    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  // 4. CEO update feedback status and notes
  async updateFeedbackStatus(id: string, dto: UpdateFeedbackStatusDto) {
    const feedback = await this.feedbackModel.findById(id);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    feedback.status = dto.status;
    if (dto.ceoNotes) feedback.ceoNotes = dto.ceoNotes;
    await feedback.save();

    return {
      success: true,
      message: 'Feedback updated by CEO',
      data: feedback,
    };
  }
}
