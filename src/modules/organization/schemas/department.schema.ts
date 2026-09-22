import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true })
export class Department {
  @Prop({ required: true, unique: true, trim: true })
  name: string; // Technology, Skill Campus, B School, HR, Executive & Admin

  @Prop({ default: '' })
  code: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  leadId?: MongooseSchema.Types.ObjectId;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
