import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SalaryIncrementDocument = SalaryIncrement & Document;

@Schema({ timestamps: true })
export class SalaryIncrement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  previousSalary: number;

  @Prop({ required: true })
  incrementAmount: number;

  @Prop({ default: 0 })
  incrementPercentage: number;

  @Prop({ required: true })
  newSalary: number;

  @Prop({ required: true, type: Date, default: Date.now })
  effectiveDate: Date;

  @Prop({ default: 'Annual Appraisal' })
  reason: string; // e.g. 'Annual Appraisal', 'Promotion', 'Performance Bonus', 'Probation Completion', 'Market Correction'

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedBy?: MongooseSchema.Types.ObjectId;

  @Prop({ default: 'APPROVED', enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  status: string;

  @Prop({ default: '' })
  remarks?: string;
}

export const SalaryIncrementSchema = SchemaFactory.createForClass(SalaryIncrement);
SalaryIncrementSchema.index({ userId: 1, effectiveDate: -1 });
SalaryIncrementSchema.index({ effectiveDate: -1 });
