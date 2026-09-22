import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AttendancePolicyDocument = AttendancePolicy & Document;

@Schema({ timestamps: true })
export class AttendancePolicy {
  @Prop({ default: 'Standard Shift' })
  policyName: string;

  @Prop({ default: '09:00' })
  workStartTime: string; // HH:mm

  @Prop({ default: '18:00' })
  workEndTime: string; // HH:mm

  @Prop({ default: 15 })
  gracePeriodMinutes: number;

  @Prop({ default: 240 }) // 4 hours
  halfDayThresholdMinutes: number;

  @Prop({ default: 480 }) // 8 hours
  fullDayThresholdMinutes: number;

  @Prop({ default: 60 })
  defaultBreakMinutes: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const AttendancePolicySchema = SchemaFactory.createForClass(AttendancePolicy);
