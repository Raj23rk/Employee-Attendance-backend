import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  category: string; // Campus, Hackathon, Placement, Social, Tech Talk

  @Prop({ required: true })
  eventDate: Date;

  @Prop({ default: 'Campus Auditorium' })
  location: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  rsvps: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  volunteers: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);
