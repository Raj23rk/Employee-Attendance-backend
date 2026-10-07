import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SalaryStructureDocument = SalaryStructure & Document;

@Schema({ timestamps: true })
export class SalaryStructure {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, default: 20000 })
  baseSalary: number;

  @Prop({ required: true, default: 20000 })
  grossSalary: number;

  @Prop({ required: true, default: 20000 })
  netSalary: number;

  @Prop({ default: 0 })
  basic: number;

  @Prop({ default: 0 })
  hra: number;

  @Prop({ default: 0 })
  specialAllowance: number;

  @Prop({ default: 0 })
  conveyanceAllowance: number;

  @Prop({ default: 0 })
  otherAllowances: number;

  @Prop({ default: 0 })
  pfDeduction: number;

  @Prop({ default: 0 })
  esiDeduction: number;

  @Prop({ default: 0 })
  tdsDeduction: number;

  @Prop({ default: 0 })
  professionalTax: number;

  @Prop({ type: Date, default: null })
  effectiveFrom?: Date;

  @Prop({ default: 'BANK_TRANSFER', enum: ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI'] })
  paymentMode: string;

  @Prop({ default: '' })
  notes?: string;
}

export const SalaryStructureSchema = SchemaFactory.createForClass(SalaryStructure);
