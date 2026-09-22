import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EmployeeDocumentRecord = EmployeeDocument & Document;

@Schema({ timestamps: true })
export class EmployeeDocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  category: string; // Offer Letter, ID Proof, Degree Certificate, Medical/Maternity Proof, Payslip

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ default: 'PDF' })
  fileType: string;

  @Prop({ default: 0 })
  fileSize: number;
}

export const EmployeeDocumentSchema = SchemaFactory.createForClass(EmployeeDocument);
