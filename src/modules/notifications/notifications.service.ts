import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  NotificationTemplate,
  NotificationTemplateDocument,
} from './schemas/notification-template.schema';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/template.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resendClient: Resend | null = null;

  constructor(
    @InjectModel(NotificationTemplate.name)
    private templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('resend.apiKey');
    if (apiKey && apiKey !== 're_demo_placeholder_key') {
      try {
        this.resendClient = new Resend(apiKey);
      } catch (err) {
        this.logger.warn(`Failed to initialize Resend client: ${err.message}`);
      }
    }
  }

  // Interpolate placeholders like {{name}} with payload values
  interpolate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    return result;
  }

  // Send Email using DB Template & Resend
  async sendEmail(
    to: string,
    templateCode: string,
    data: Record<string, any>,
    customSubject?: string,
  ): Promise<boolean> {
    try {
      const template = await this.templateModel.findOne({
        code: templateCode.toUpperCase(),
        isActive: true,
      });

      let subject = customSubject || `Notification: ${templateCode}`;
      let html = `<p>Notification for ${to}</p>`;

      if (template) {
        subject = customSubject || this.interpolate(template.subject, data);
        html = this.interpolate(template.bodyHtml, data);
      } else {
        this.logger.warn(`Notification template ${templateCode} not found in database. Using fallback.`);
      }

      if (this.resendClient) {
        await this.resendClient.emails.send({
          from: 'HR Portal <onboarding@resend.dev>',
          to,
          subject,
          html,
        });
        this.logger.log(`Resend email sent to ${to} with template ${templateCode}`);
        return true;
      } else {
        this.logger.log(
          `[Email Simulated (Safe Mode)] To: ${to} | Subject: "${subject}" | Template: ${templateCode}`,
        );
        return true;
      }
    } catch (error) {
      this.logger.error(`Error sending email to ${to}: ${error.message}`);
      return false;
    }
  }

  // Create in-app notification
  async createInAppNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    link: string = '',
  ): Promise<NotificationDocument> {
    return this.notificationModel.create({
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    });
  }

  // Get user notifications
  async getUserNotifications(userId: string) {
    const list = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    const unreadCount = await this.notificationModel.countDocuments({
      userId,
      isRead: false,
    });

    return { success: true, unreadCount, data: list };
  }

  // Mark single notification as read
  async markAsRead(notificationId: string, userId: string) {
    const item = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true },
    );
    return { success: true, data: item };
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany({ userId, isRead: false }, { isRead: true });
    return { success: true, message: 'All notifications marked as read' };
  }

  // Template Management (HR / Admin)
  async getAllTemplates() {
    const templates = await this.templateModel.find().sort({ code: 1 }).exec();
    return { success: true, count: templates.length, data: templates };
  }

  async createTemplate(dto: CreateNotificationTemplateDto) {
    const created = await this.templateModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return { success: true, message: 'Notification template created', data: created };
  }

  async updateTemplate(code: string, dto: UpdateNotificationTemplateDto) {
    const updated = await this.templateModel.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $set: dto },
      { new: true, upsert: false },
    );
    return { success: true, message: 'Notification template updated', data: updated };
  }
}
