import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyExpenseDocument = DailyExpense & Document;

@Schema({ timestamps: true })
export class DailyExpense {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    enum: [
      'Office Supplies',
      'Utilities',
      'Food & Refreshments',
      'Maintenance',
      'Travel & Fuel',
      'Hardware & Electronics',
      'Software & Subscriptions',
      'Rent & Facility',
      'Client Meeting',
      'Miscellaneous',
    ],
    default: 'Miscellaneous',
    index: true,
  })
  category: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD format (e.g. 2026-09-22)

  @Prop({
    required: true,
    enum: ['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'CHEQUE'],
    default: 'UPI',
  })
  paymentMode: string;

  @Prop({ default: '' })
  vendorName?: string;

  @Prop({ default: '' })
  billUrl?: string; // Attachment / document / bill receipt URL or file path

  @Prop({ default: '' })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recordedBy: Types.ObjectId; // Admin / HR / CEO who logged this expense

  @Prop({
    enum: ['PAID', 'PENDING', 'APPROVED', 'CANCELLED'],
    default: 'PAID',
    index: true,
  })
  status: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];
}

export const DailyExpenseSchema = SchemaFactory.createForClass(DailyExpense);
