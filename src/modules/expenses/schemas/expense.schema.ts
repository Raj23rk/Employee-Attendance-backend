import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  category: string; // Travel, Food, Internet, Hardware, Client Meeting

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  description: string;

  @Prop({ default: '' })
  billUrl?: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'],
    default: 'PENDING',
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

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
