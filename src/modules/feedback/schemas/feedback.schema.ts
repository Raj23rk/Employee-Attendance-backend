import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, default: 'GENERAL' })
  category: string; // WORKPLACE_CULTURE, INFRASTRUCTURE, PROCESSES, MANAGEMENT, SUGGESTION, OTHER

  @Prop({ required: true })
  message: string;

  @Prop({ default: '' })
  suggestions: string;

  // Confidential: Only populated and visible to the CEO
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, select: true })
  submittedBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: 'OPEN', enum: ['OPEN', 'REVIEWED', 'ACTION_TAKEN'] })
  status: string;

  @Prop({ default: '' })
  ceoNotes?: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
