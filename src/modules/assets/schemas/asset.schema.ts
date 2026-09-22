import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AssetDocument = Asset & Document;

@Schema({ timestamps: true })
export class Asset {
  @Prop({ required: true, unique: true, index: true })
  assetTag: string; // e.g., AST-LAP-042

  @Prop({ required: true })
  name: string; // MacBook Pro M3, Dell 27 Monitor, Access ID Card

  @Prop({ required: true })
  category: string; // Laptop, Monitor, Peripheral, Access Card

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  assignedToId?: MongooseSchema.Types.ObjectId;

  @Prop({ default: 'ASSIGNED', enum: ['AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'RETIRED'] })
  status: string;

  @Prop({ type: Date, default: null })
  assignedDate?: Date;

  @Prop({
    type: [
      {
        requestType: { type: String }, // REPAIR, REPLACEMENT, RETURN
        description: { type: String },
        status: { type: String, default: 'OPEN' },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  serviceRequests: {
    requestType: string;
    description: string;
    status: string;
    requestedAt: Date;
  }[];
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
