import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { TicketStatus, TicketPriority } from '../../../common/enums/task-status.enum';

export type TicketDocument = Ticket & Document;

@Schema({ _id: true, timestamps: true })
export class TicketReply {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ default: '' })
  attachmentUrl?: string;
}

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  category: string; // IT, HR, Payroll, Admin, Facility

  @Prop({ required: true })
  description: string;

  @Prop({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Prop({ enum: TicketStatus, default: TicketStatus.OPEN, index: true })
  status: TicketStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  creatorId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  assignedToId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [TicketReply], default: [] })
  replies: TicketReply[];
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
