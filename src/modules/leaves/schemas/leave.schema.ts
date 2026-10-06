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

  @Prop({ default: false })
  isHalfDay: boolean;

  @Prop({ default: '' })
  halfDaySession?: string; // 'FIRST_HALF' | 'SECOND_HALF' | 'MORNING' | 'AFTERNOON'

  @Prop({ default: 0 })
  paidDays: number;

  @Prop({ default: 0 })
  lopDays: number; // Loss of Pay days

  @Prop({ default: false })
  isLop: boolean;

  @Prop({ default: '' })
  lopReason?: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: '' })
  documentUrl?: string; // Supporting document / Medical certificate

  @Prop({ default: '' })
  medicalCertificateUrl?: string; // Mandatory for Sick/Medical leave, otherwise LOP

  @Prop({ default: false })
  isMedicalCertificateVerified: boolean;

  @Prop({ default: 'Chennai Main Campus' })
  branch?: string;

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
LeaveSchema.index({ userId: 1, status: 1 });
LeaveSchema.index({ status: 1, startDate: 1 });
LeaveSchema.index({ startDate: 1, endDate: 1 });
