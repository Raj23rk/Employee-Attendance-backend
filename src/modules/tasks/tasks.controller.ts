import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get tasks assigned to current user grouped by Kanban columns' })
  async getMyTasks(@CurrentUser('id') userId: string) {
    return this.tasksService.getMyTasksGrouped(userId);
  }

  @Post()
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Create new task (Manager/HR)' })
  async createTask(
    @CurrentUser('id') creatorId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(creatorId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Move task status (Backlog, To Do, In Progress, Review, Completed)' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateTaskStatus(id, userId, dto);
  }
}
