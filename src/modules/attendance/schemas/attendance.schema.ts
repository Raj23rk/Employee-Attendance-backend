import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AttendanceStatus, AttendanceSource } from '../../../common/enums/attendance-status.enum';

export type AttendanceDocument = Attendance & Document;

@Schema({ _id: false })
export class LocationDetails {
  @Prop({ default: null })
  latitude: number;

  @Prop({ default: null })
  longitude: number;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  branch: string;

  @Prop({ default: 0 })
  distanceMeters: number;

  @Prop({ default: true })
  isWithinOfficeRadius: boolean;
}

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

  // Location Geolocation Tracking
  @Prop({ default: null })
  latitude?: number;

  @Prop({ default: null })
  longitude?: number;

  @Prop({ default: '' })
  locationAddress?: string;

  @Prop({ default: 'Chennai Main Campus' })
  branchName?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', default: null })
  branchId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: LocationDetails, default: () => ({}) })
  checkInLocation?: LocationDetails;

  @Prop({ type: LocationDetails, default: () => ({}) })
  checkOutLocation?: LocationDetails;

  // Late Arrival & Grace Policy Tracking
  // Rule: Normal checkin 9:40 AM, Grace 9:45 AM. 3 late check-ins allowed per month. 4th time half day salary deduction.
  @Prop({ default: false })
  isLate: boolean;

  @Prop({ default: 0 })
  lateMinutes: number;

  @Prop({ default: 0 })
  lateCountThisMonth: number;

  @Prop({ default: false })
  isLatePenaltyApplied: boolean; // True on 4th late arrival in month (half-day penalty)

  @Prop({ default: 'NONE', enum: ['NONE', 'HALF_DAY_DEDUCTION', 'FULL_DAY_DEDUCTION'] })
  latePenaltyType: string;

  @Prop({ default: '' })
  ipAddress?: string;

  @Prop({ default: '' })
  notes?: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ date: 1, branchName: 1 });
AttendanceSchema.index({ userId: 1, isLate: 1 });
AttendanceSchema.index({ userId: 1, date: -1 });
