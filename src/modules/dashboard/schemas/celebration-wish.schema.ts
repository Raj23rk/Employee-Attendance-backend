import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CelebrationWishDocument = CelebrationWish & Document;

@Schema({ timestamps: true })
export class CelebrationWish {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  targetUserId: MongooseSchema.Types.ObjectId; // User receiving the celebration wish

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  fromUserId: MongooseSchema.Types.ObjectId; // Colleague sending the wish

  @Prop({ required: true, enum: ['BIRTHDAY', 'WORK_ANNIVERSARY', 'NEW_JOINER', 'GENERAL'] })
  occasionType: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ default: '🎉' })
  reactionEmoji: string;
}

export const CelebrationWishSchema = SchemaFactory.createForClass(CelebrationWish);
