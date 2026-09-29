import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AttendancePolicyDocument = AttendancePolicy & Document;

@Schema({ timestamps: true })
export class AttendancePolicy {
  @Prop({ default: 'Standard Shift Policy' })
  policyName: string;

  @Prop({ default: '09:40' }) // 9:40 AM Normal check-in
  workStartTime: string; // HH:mm

  @Prop({ default: '09:45' }) // 9:45 AM Grace check-in
  graceTime: string;

  @Prop({ default: '19:00' }) // 7:00 PM Check-out
  workEndTime: string; // HH:mm

  @Prop({ default: 5 }) // Grace period minutes (9:40 to 9:45)
  gracePeriodMinutes: number;

  @Prop({ default: 3 }) // 3 late check-ins allowed per month without penalty
  allowedLateCheckins: number;

  @Prop({ default: 2 }) // 2 hours permission allowed per month
  maxMonthlyPermissionHours: number;

  @Prop({ default: 270 }) // 4.5 hours for half-day
  halfDayThresholdMinutes: number;

  @Prop({ default: 500 }) // ~8.33 hours for full-day
  fullDayThresholdMinutes: number;

  @Prop({ default: 60 })
  defaultBreakMinutes: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const AttendancePolicySchema = SchemaFactory.createForClass(AttendancePolicy);
