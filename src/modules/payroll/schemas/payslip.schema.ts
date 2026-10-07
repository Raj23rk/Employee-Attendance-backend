import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PayslipDocument = Payslip & Document;

@Schema({ timestamps: true })
export class Payslip {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ default: '' })
  payslipNo: string; // e.g. "PR004/26-27"

  @Prop({ required: true, index: true })
  monthYear: string; // e.g. "September 2026", "October 2026"

  @Prop({ default: 10 })
  month: number;

  @Prop({ default: 2026 })
  year: number;

  @Prop({ required: true, default: 0 })
  baseSalary: number;

  @Prop({ required: true, default: 0 })
  grossPay: number;

  @Prop({ default: 0 })
  incentives: number;

  @Prop({ default: 0 })
  incentiveCount: number;

  @Prop({ default: 30 })
  totalDaysInMonth: number;

  @Prop({ default: 26 })
  workingDays: number;

  @Prop({ default: 0 })
  presentDays: number;

  @Prop({ default: 0 })
  halfDays: number;

  @Prop({ default: 0 })
  paidDays: number; // Payable Days

  @Prop({ default: 0 })
  absentDays: number;

  @Prop({ default: 0 })
  paidLeaves: number; // Casual Leave (CL)

  @Prop({ default: 0 })
  lateCount: number;

  @Prop({ default: 0 })
  latePenaltyDays: number;

  @Prop({ default: 0 })
  lopDays: number; // Loss of Pay days

  @Prop({ default: 0 })
  dailyRate: number; // baseSalary / totalDaysInMonth

  @Prop({ default: 0 })
  attendanceDeduction: number; // Loss of Pay (LOP) Deduction

  @Prop({ default: 0 })
  otherDeductions: number;

  @Prop({ default: 0 })
  pfDeduction: number;

  @Prop({ default: 0 })
  esiDeduction: number;

  @Prop({ default: 0 })
  tdsDeduction: number;

  @Prop({ default: 0 })
  totalDeductions: number;

  @Prop({ required: true, default: 0 })
  netPay: number;

  @Prop({ default: '' })
  amountInWords: string;

  @Prop({
    type: Object,
    default: () => ({
      basic: 0,
      hra: 0,
      specialAllowance: 0,
      otherAllowances: 0,
      lopDeduction: 0,
      pf: 0,
      esi: 0,
      tds: 0,
    }),
  })
  breakdown: Record<string, number>;

  @Prop({ default: 'PROCESSED', enum: ['DRAFT', 'GENERATED', 'APPROVED', 'PROCESSED', 'PAID'] })
  status: string;

  @Prop({ type: Date, default: null })
  paymentDate?: Date;

  @Prop({ default: '' })
  pdfUrl?: string;

  @Prop({ default: '' })
  notes?: string;
}

export const PayslipSchema = SchemaFactory.createForClass(Payslip);
PayslipSchema.index({ userId: 1, monthYear: 1 }, { unique: true });
PayslipSchema.index({ monthYear: 1 });
PayslipSchema.index({ userId: 1, year: 1, month: 1 });
