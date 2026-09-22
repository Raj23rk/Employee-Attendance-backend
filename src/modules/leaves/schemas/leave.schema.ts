import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LeaveType, LeaveStatus } from '../../../common/enums/leave-type.enum';

export type LeaveDocument = Leave & Document;

@Schema({ timestamps: true })
export class Leave {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: LeaveType })
  leaveType: LeaveType;

  @Prop({ required: true })
  fromDate: string; // YYYY-MM-DD

  @Prop({ required: true })
  toDate: string; // YYYY-MM-DD

  @Prop({ required: true, min: 0.5 })
  days: number;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: '' })
  documentUrl?: string;

  @Prop({
    required: true,
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
    index: true,
  })
  status: LeaveStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId;

  @Prop({ default: '' })
  reviewComments?: string;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date;
}

export const LeaveSchema = SchemaFactory.createForClass(Leave);
