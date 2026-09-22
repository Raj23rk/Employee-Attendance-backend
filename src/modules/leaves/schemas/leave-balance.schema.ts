import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type LeaveBalanceDocument = LeaveBalance & Document;

@Schema({ timestamps: true })
export class LeaveBalance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, default: () => new Date().getFullYear() })
  year: number;

  @Prop({ default: 15 })
  annual: number;

  @Prop({ default: 12 })
  casual: number;

  @Prop({ default: 10 })
  sick: number;

  // Maternity leave for female employees (e.g. 182 days / 26 weeks statutory)
  @Prop({ default: 0 })
  maternity: number;

  // Paternity / New Child Birth leave for male employees (3 days paid)
  @Prop({ default: 0 })
  paternity: number;

  @Prop({ default: 0 })
  lossOfPay: number;
}

export const LeaveBalanceSchema = SchemaFactory.createForClass(LeaveBalance);
