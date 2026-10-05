import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';
import { TaskStatus, TaskPriority } from '../../common/enums/task-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async getMyTasksGrouped(userId: string) {
    const tasks = await this.taskModel
      .find({ assigneeId: new Types.ObjectId(userId) })
      .populate('createdById', 'name email employeeId')
      .populate('assigneeId', 'name email employeeId department designation')
      .sort({ dueDate: 1, createdAt: -1 })
      .exec();

    return this.groupTasksIntoColumns(tasks);
  }

  async getAllTasksGrouped(query?: { project?: string; assigneeId?: string; status?: string }) {
    const filter: any = {};
    if (query?.project && query.project !== 'ALL') {
      filter.project = query.project;
    }
    if (query?.assigneeId && query.assigneeId !== 'ALL') {
      if (isValidObjectId(query.assigneeId)) {
        filter.assigneeId = new Types.ObjectId(query.assigneeId);
      }
    }
    if (query?.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    const tasks = await this.taskModel
      .find(filter)
      .populate('createdById', 'name email employeeId')
      .populate('assigneeId', 'name email employeeId department designation')
      .sort({ dueDate: 1, createdAt: -1 })
      .exec();

    return this.groupTasksIntoColumns(tasks);
  }

  private groupTasksIntoColumns(tasks: any[]) {
    const columns: Record<string, any[]> = {
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
    // 1. Resolve Assignee
    let assignee: UserDocument | null = null;
    const rawAssignee = dto.assigneeId || dto.assignedTo || dto.assigneeEmail || dto.staffName || dto.assigneeName;

    if (rawAssignee) {
      if (isValidObjectId(rawAssignee)) {
        assignee = await this.userModel.findById(rawAssignee);
      }
      if (!assignee) {
        assignee = await this.userModel.findOne({
          $or: [
            { email: rawAssignee.toLowerCase().trim() },
            { employeeId: rawAssignee.trim() },
            { name: { $regex: new RegExp(`^${rawAssignee.trim()}$`, 'i') } },
          ],
        });
      }
    }

    // If still no assignee found, fallback to creator
    if (!assignee) {
      assignee = await this.userModel.findById(creatorId);
    }

    const creator = await this.userModel.findById(creatorId);
    const creatorName = creator ? creator.name : 'Management / HR';

    const targetAssigneeId = assignee ? assignee._id : new Types.ObjectId(creatorId);

    // 2. Create Task Record
    const task = await this.taskModel.create({
      title: dto.title,
      description: dto.description || '',
      project: dto.project || 'General',
      priority: dto.priority || TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      assigneeId: targetAssigneeId,
      createdById: new Types.ObjectId(creatorId),
    });

    const populatedTask = await this.taskModel
      .findById(task._id)
      .populate('createdById', 'name email employeeId')
      .populate('assigneeId', 'name email employeeId department designation')
      .exec();

    // 3. Send Notifications (In-App & Email via Resend)
    if (assignee && assignee.email) {
      const dueDateFormatted = dto.dueDate
        ? new Date(dto.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Not Specified';

      // Send In-App Notification
      try {
        await this.notificationsService.createInAppNotification(
          assignee._id.toString(),
          `New Task Assigned: ${dto.title}`,
          `${creatorName} has assigned you a task "${dto.title}" (${dto.priority || 'MEDIUM'} priority). Due: ${dueDateFormatted}.`,
          'INFO',
          '/tasks',
        );
      } catch (err) {
        this.logger.warn(`Failed to create in-app notification: ${err.message}`);
      }

      // Send Email Notification via Resend
      try {
        await this.notificationsService.sendEmail(
          assignee.email,
          'TASK_ASSIGNED',
          {
            assigneeName: assignee.name,
            taskTitle: dto.title,
            project: dto.project || 'General',
            priority: dto.priority || 'MEDIUM',
            dueDate: dueDateFormatted,
            assignedByName: creatorName,
            description: dto.description || 'No additional instructions provided.',
          },
          `New Task Assigned: ${dto.title} 📋`,
        );
        this.logger.log(`Task assignment email dispatched to ${assignee.email} for "${dto.title}"`);
      } catch (err) {
        this.logger.error(`Failed to send task assignment email: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `Task created and assigned to ${assignee ? assignee.name : 'Staff'} successfully. Email notification dispatched.`,
      data: populatedTask,
    };
  }

  async updateTaskStatus(taskId: string, userId: string, dto: UpdateTaskStatusDto) {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.status = dto.status;
    await task.save();

    const populatedTask = await this.taskModel
      .findById(task._id)
      .populate('createdById', 'name email employeeId')
      .populate('assigneeId', 'name email employeeId department designation')
      .exec();

    return { success: true, message: 'Task status updated', data: populatedTask };
  }
}

