import {
  Controller,
  Get,
  Post,
  Put,
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
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/template.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications & unread count' })
  async getMyNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  // HR / CEO Template Management
  @Get('templates')
  @Roles(Role.HR, Role.CEO)
  @ApiOperation({ summary: 'List all email notification templates in database' })
  async getAllTemplates() {
    return this.notificationsService.getAllTemplates();
  }

  @Post('templates')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'Create a new database notification template' })
  async createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Put('templates/:code')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'Update a database notification template by code' })
  async updateTemplate(
    @Param('code') code: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(code, dto);
  }
}
