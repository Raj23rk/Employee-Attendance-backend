import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SalaryStructureDocument = SalaryStructure & Document;

@Schema({ timestamps: true })
export class SalaryStructure {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, default: 50000 })
  grossSalary: number;

  @Prop({ required: true, default: 45000 })
  netSalary: number;

  @Prop({ default: 25000 })
  basic: number;

  @Prop({ default: 12500 })
  hra: number;

  @Prop({ default: 7500 })
  specialAllowance: number;

  @Prop({ default: 5000 })
  otherAllowances: number;

  @Prop({ default: 1800 })
  pfDeduction: number;

  @Prop({ default: 750 })
  esiDeduction: number;

  @Prop({ default: 2450 })
  tdsDeduction: number;
}

export const SalaryStructureSchema = SchemaFactory.createForClass(SalaryStructure);
