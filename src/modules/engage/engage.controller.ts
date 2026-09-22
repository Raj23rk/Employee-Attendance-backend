import {
  Controller,
  Get,
  Post,
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
import { EngageService } from './engage.service';
import {
  CreateAnnouncementDto,
  CreateTravelRequestDto,
} from './dto/engage.dto';

@ApiTags('Engage (Announcements & Events)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class EngageController {
  constructor(private readonly engageService: EngageService) {}

  @Get('announcements')
  @ApiOperation({ summary: 'Get company announcements with category tags' })
  async getAnnouncements() {
    return this.engageService.getAnnouncements();
  }

  @Post('announcements')
  @Roles(Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Post new company announcement' })
  async createAnnouncement(
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.engageService.createAnnouncement(authorId, dto);
  }

  @Post('announcements/:id/like')
  @ApiOperation({ summary: 'Like or unlike an announcement' })
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.engageService.toggleLike(id, userId);
  }

  @Get('events')
  @ApiOperation({ summary: 'Campus events and placement drives list' })
  async getEvents() {
    return this.engageService.getEvents();
  }

  @Post('events/:id/rsvp')
  @ApiOperation({ summary: 'RSVP or sign up as volunteer for an event' })
  async toggleRsvp(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.engageService.toggleRsvp(id, userId);
  }

  @Post('events/travel-request')
  @ApiOperation({ summary: 'Submit official travel booking request' })
  async createTravelRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTravelRequestDto,
  ) {
    return this.engageService.createTravelRequest(userId, dto);
  }
}
