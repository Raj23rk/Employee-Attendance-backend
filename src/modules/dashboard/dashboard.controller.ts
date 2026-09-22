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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { DashboardService } from './dashboard.service';
import { SendCelebrationWishDto } from './dto/wish.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get top KPI cards, today check-in status, pending items count' })
  async getOverview(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.dashboardService.getOverview(userId, role);
  }

  @Get('celebrations')
  @ApiOperation({ summary: 'Upcoming birthdays, work anniversaries, and recent wishes' })
  async getCelebrations() {
    return this.dashboardService.getCelebrations();
  }

  @Post('celebrations/:id/wish')
  @ApiOperation({ summary: 'Send celebration wish message to colleague' })
  async sendWish(
    @Param('id') targetUserId: string,
    @CurrentUser('id') fromUserId: string,
    @Body() dto: SendCelebrationWishDto,
  ) {
    return this.dashboardService.sendWish(targetUserId, fromUserId, dto);
  }

  @Get('holidays-spotlight')
  @ApiOperation({ summary: 'Upcoming company holidays with countdown' })
  async getHolidaysSpotlight() {
    return this.dashboardService.getHolidaysSpotlight();
  }

  @Get('on-leave-today')
  @ApiOperation({ summary: 'Colleague names on leave today' })
  async getOnLeaveToday() {
    return this.dashboardService.getOnLeaveToday();
  }

  @Get('hours-logged-chart')
  @ApiOperation({ summary: '7-day weekly work hours curve for dashboard chart' })
  async getHoursLoggedChart(@CurrentUser('id') userId: string) {
    return this.dashboardService.getHoursLoggedChart(userId);
  }
}
