import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PayslipDocument = Payslip & Document;

@Schema({ timestamps: true })
export class Payslip {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  monthYear: string; // e.g. "09-2026" or "September 2026"

  @Prop({ required: true })
  grossPay: number;

  @Prop({ required: true })
  netPay: number;

  @Prop({ default: 0 })
  totalDeductions: number;

  @Prop({ default: 30 })
  workingDays: number;

  @Prop({ default: 30 })
  paidDays: number;

  @Prop({ default: 'PAID' })
  status: string;

  @Prop({ default: '' })
  pdfUrl?: string;
}

export const PayslipSchema = SchemaFactory.createForClass(Payslip);
PayslipSchema.index({ userId: 1, monthYear: 1 }, { unique: true });
