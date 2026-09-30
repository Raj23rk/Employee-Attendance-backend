import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, unique: true, trim: true })
  name: string; // e.g. "Chennai Main Campus"

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string; // e.g. "CHN-01"

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  city: string;

  @Prop({ default: 'Tamil Nadu' })
  state: string;

  @Prop({ default: 13.0827 }) // Default coordinates
  latitude: number;

  @Prop({ default: 80.2707 })
  longitude: number;

  @Prop({ default: 500 }) // Radius in meters for geofence validation
  radiusMeters: number;

  @Prop({ default: '' })
  contactEmail?: string;

  @Prop({ default: '' })
  contactPhone?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  branchHeadId?: MongooseSchema.Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
