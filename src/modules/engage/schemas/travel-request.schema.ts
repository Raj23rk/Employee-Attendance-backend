import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TravelRequestDocument = TravelRequest & Document;

@Schema({ timestamps: true })
export class TravelRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  purpose: string;

  @Prop({ required: true })
  destination: string;

  @Prop({ required: true })
  fromDate: string; // YYYY-MM-DD

  @Prop({ required: true })
  toDate: string; // YYYY-MM-DD

  @Prop({ default: 0 })
  estimatedCost: number;

  @Prop({
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: MongooseSchema.Types.ObjectId;

  @Prop({ default: '' })
  remarks?: string;
}

export const TravelRequestSchema = SchemaFactory.createForClass(TravelRequest);
