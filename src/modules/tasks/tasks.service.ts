import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';
import { TaskStatus } from '../../common/enums/task-status.enum';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async getMyTasksGrouped(userId: string) {
    const tasks = await this.taskModel
      .find({ assigneeId: new Types.ObjectId(userId) })
      .populate('createdById', 'name email')
      .sort({ dueDate: 1, createdAt: -1 })
      .exec();

    // Group by Kanban columns
    const columns: Record<string, TaskDocument[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      COMPLETED: [],
    };

    tasks.forEach((t) => {
      const col = t.status || TaskStatus.TODO;
      if (!columns[col]) columns[col] = [];
      columns[col].push(t);
    });

    return {
      success: true,
      total: tasks.length,
      columns,
      data: tasks,
    };
  }

  async createTask(creatorId: string, dto: CreateTaskDto) {
    const task = await this.taskModel.create({
      ...dto,
      assigneeId: new Types.ObjectId(dto.assigneeId),
      createdById: new Types.ObjectId(creatorId),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    return { success: true, message: 'Task created successfully', data: task };
  }

  async updateTaskStatus(taskId: string, userId: string, dto: UpdateTaskStatusDto) {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.status = dto.status;
    await task.save();

    return { success: true, message: 'Task status updated', data: task };
  }
}
