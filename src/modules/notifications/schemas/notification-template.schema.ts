import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationTemplateDocument = NotificationTemplate & Document;

@Schema({ timestamps: true })
export class NotificationTemplate {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string; // e.g. LEAVE_APPROVED, PUNCH_REMINDER, CORRECTION_REVIEWED, WISH_RECEIVED

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  subject: string; // Email Subject with placeholders e.g. "Leave Request {{status}} for {{name}}"

  @Prop({ required: true })
  bodyHtml: string; // HTML Template with {{placeholders}}

  @Prop({ default: '' })
  bodyText?: string;

  @Prop({ type: [String], default: [] })
  variables: string[]; // e.g. ['name', 'status', 'link', 'date']

  @Prop({ default: true })
  isActive: boolean;
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);
