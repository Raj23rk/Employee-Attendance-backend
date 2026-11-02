import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { TaskStatus, TaskPriority } from '../../../common/enums/task-status.enum';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'General' })
  project: string;

  @Prop({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Prop({ enum: TaskStatus, default: TaskStatus.TODO, index: true })
  status: TaskStatus;

  @Prop({ type: Date, default: null })
  dueDate?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  assigneeId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdById: MongooseSchema.Types.ObjectId;

  @Prop({
    type: [
      {
        status: { type: String, required: true },
        changedBy: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
        changedByName: { type: String },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    default: [],
  })
  statusHistory?: {
    status: string;
    changedBy?: any;
    changedByName?: string;
    changedAt?: Date;
    note?: string;
  }[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
