import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '../../../common/enums/task-status.enum';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  staffName?: string;

  @IsOptional()
  @IsString()
  assigneeName?: string;

  @IsOptional()
  @IsString()
  assigneeEmail?: string;
}

export class UpdateTaskStatusDto {
  @IsNotEmpty()
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
