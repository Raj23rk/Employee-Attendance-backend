import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TimesheetDocument = Timesheet & Document;

@Schema({ _id: false })
export class DailyHourEntry {
  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true, default: 0 })
  hours: number;
}

@Schema({ _id: false })
export class ProjectTimesheetRow {
  @Prop({ required: true })
  project: string;

  @Prop({ default: '' })
  taskDescription?: string;

  @Prop({ type: [DailyHourEntry], default: [] })
  entries: DailyHourEntry[];

  @Prop({ default: 0 })
  totalHours: number;
}

@Schema({ timestamps: true })
export class Timesheet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  weekStartDate: string; // YYYY-MM-DD

  @Prop({ required: true })
  weekEndDate: string; // YYYY-MM-DD

  @Prop({ type: [ProjectTimesheetRow], default: [] })
  rows: ProjectTimesheetRow[];

  @Prop({ default: 0 })
  totalHours: number;

  @Prop({
    required: true,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId;

  @Prop({ default: '' })
  remarks?: string;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date;
}

export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);
TimesheetSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });
