import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HolidayDocument = Holiday & Document;

@Schema({ timestamps: true })
export class Holiday {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ default: 'National' })
  type: string; // National, Festival, Optional

  @Prop({ default: '' })
  description: string;
}

export const HolidaySchema = SchemaFactory.createForClass(Holiday);
