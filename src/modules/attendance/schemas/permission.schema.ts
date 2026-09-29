import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum PermissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export type PermissionDocument = Permission & Document;

@Schema({ timestamps: true })
export class Permission {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  startTime: string; // e.g. "09:40 AM" or "10:00"

  @Prop({ required: true })
  endTime: string; // e.g. "11:40 AM" or "12:00"

  @Prop({ required: true, min: 0.25 }) // Hours (e.g. 1.0, 1.5, 2.0)
  durationHours: number;

  @Prop({ required: true, min: 15 }) // Duration in minutes
  durationMinutes: number;

  @Prop({ required: true })
  reason: string;

  @Prop({
    required: true,
    enum: PermissionStatus,
    default: PermissionStatus.PENDING,
    index: true,
  })
  status: PermissionStatus;

  @Prop({ default: false })
  exceedsMonthlyLimit: boolean; // True if employee exceeded 2 hours this month

  @Prop({ default: false })
  isSalaryDeductionApplied: boolean; // True if half-day salary deducted due to overage

  @Prop({ default: 0 })
  halfDayDeductionCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: MongooseSchema.Types.ObjectId;

  @Prop({ default: '' })
  reviewRemarks?: string;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
