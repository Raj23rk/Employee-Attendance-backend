import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { DashboardService } from './dashboard.service';
import { SendCelebrationWishDto } from './dto/wish.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  // HR & CEO: Employee Details Table (Filters: Branch, Department, Status, Search)
  // Table displays: ID, Name, Date of Joining, Branch, Check-in, Check-out, Action Popup
  @Get('hr-ceo/employees')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'HR & CEO side employee details dashboard with branch-wise filters, DOJ, checkin, checkout' })
  async getHrCeoEmployees(
    @Query('branch') branch?: string,
    @Query('dept') dept?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getHrCeoEmployeeDashboard({
      branch,
      department: dept,
      status,
      search,
      date,
      page,
      limit,
    });
  }

  // HR & CEO: Employee Full Details Popup Modal API
  @Get('hr-ceo/employees/:id/popup')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Action button popup: Complete employee details, bank account info, user details, check-in status, active state' })
  async getEmployeePopupDetails(@Param('id') id: string) {
    return this.dashboardService.getEmployeeFullDetailsPopup(id);
  }

  // HR & CEO: Download Individual Employee Report (CSV / Statement)
  @Get('hr-ceo/employees/:id/export-report')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Download individual employee detailed attendance & payroll statement' })
  async exportIndividualReport(
    @Param('id') id: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
  ) {
    const csv = await this.dashboardService.downloadIndividualEmployeeReport(id, month, year);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=employee-statement-${id}-${month || 'cur'}-${year || 'cur'}.csv`);
    return res.send(csv);
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
  @ApiOperation({ summary: 'Colleague names on leave today (with branch filter)' })
  async getOnLeaveToday(@Query('branch') branch?: string) {
    return this.dashboardService.getOnLeaveToday(branch);
  }

  @Get('hours-logged-chart')
  @ApiOperation({ summary: '7-day weekly work hours curve for dashboard chart' })
  async getHoursLoggedChart(@CurrentUser('id') userId: string) {
    return this.dashboardService.getHoursLoggedChart(userId);
  }
}
