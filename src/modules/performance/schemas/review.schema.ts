import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reviewerId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  cycle: string; // e.g., "Annual 2026", "Q3 Check-in"

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  feedback: string;

  @Prop({ default: '' })
  strengths: string;

  @Prop({ default: '' })
  improvements: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
