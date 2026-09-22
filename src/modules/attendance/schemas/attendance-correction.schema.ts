import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CorrectionStatus } from '../../../common/enums/attendance-status.enum';

export type AttendanceCorrectionDocument = AttendanceCorrection & Document;

@Schema({ timestamps: true })
export class AttendanceCorrection {
  @Prop({ type: Types.ObjectId, ref: 'Attendance', default: null })
  attendanceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  targetDate: string; // YYYY-MM-DD

  @Prop({ default: '' })
  requestedCheckIn: string; // e.g., "09:15 AM" or ISO

  @Prop({ default: '' })
  requestedCheckOut: string; // e.g., "06:30 PM" or ISO

  @Prop({ required: true })
  reason: string;

  @Prop({ default: '' })
  attachmentUrl?: string;

  @Prop({
    required: true,
    enum: CorrectionStatus,
    default: CorrectionStatus.PENDING,
    index: true,
  })
  status: CorrectionStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId;

  @Prop({ default: '' })
  reviewRemarks?: string;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date;
}

export const AttendanceCorrectionSchema = SchemaFactory.createForClass(AttendanceCorrection);
