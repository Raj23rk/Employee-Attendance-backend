import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type GoalDocument = Goal & Document;

@Schema({ timestamps: true })
export class Goal {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'Q3-2026' })
  quarter: string;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number; // 0 - 100%

  @Prop({ default: 'IN_PROGRESS', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] })
  status: string;

  @Prop({ type: Date, default: null })
  dueDate?: Date;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);
