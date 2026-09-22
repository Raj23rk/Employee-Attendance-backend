import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AttendanceStatus, AttendanceSource } from '../../../common/enums/attendance-status.enum';

export type AttendanceDocument = Attendance & Document;

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD

  @Prop({ type: Date, default: null })
  checkInTime?: Date;

  @Prop({ type: Date, default: null })
  checkOutTime?: Date;

  @Prop({ default: 0 })
  totalWorkingMinutes: number;

  @Prop({ default: 60 })
  breakMinutes: number;

  @Prop({
    required: true,
    enum: AttendanceStatus,
    default: AttendanceStatus.ABSENT,
    index: true,
  })
  status: AttendanceStatus;

  @Prop({
    required: true,
    enum: AttendanceSource,
    default: AttendanceSource.WEB,
  })
  source: AttendanceSource;

  @Prop({ default: null })
  latitude?: number;

  @Prop({ default: null })
  longitude?: number;

  @Prop({ default: '' })
  ipAddress?: string;

  @Prop({ default: '' })
  notes?: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
