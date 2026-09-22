import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'Compliance' })
  category: string; // Compliance, Technical, Soft Skills, Leadership

  @Prop({ default: true })
  isMandatory: boolean;

  @Prop({ default: '4 hours' })
  duration: string;

  @Prop({ default: '' })
  thumbnailUrl?: string;

  // Track enrollments per user
  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        progress: { type: Number, default: 0 },
        completedAt: { type: Date, default: null },
      },
    ],
    default: [],
  })
  enrollments: {
    userId: Types.ObjectId;
    progress: number;
    completedAt?: Date | null;
  }[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
