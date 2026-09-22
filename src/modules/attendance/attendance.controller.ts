import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
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
import { AttendanceService } from './attendance.service';
import {
  CheckInDto,
  CheckOutDto,
  CorrectionRequestDto,
  ReviewCorrectionDto,
  HrAdjustAttendanceDto,
  SyncBiometricDto,
  UpdatePolicyDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // 1. Check In
  @Post('check-in')
  @ApiOperation({ summary: 'Punch In (Web/Mobile)' })
  async checkIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckInDto,
    @Req() req: any,
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    return this.attendanceService.checkIn(userId, dto, ip);
  }

  // 2. Check Out
  @Post('check-out')
  @ApiOperation({ summary: 'Punch Out' })
  async checkOut(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckOutDto,
    @Req() req: any,
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    return this.attendanceService.checkOut(userId, dto, ip);
  }

  // 3. Today's Status
  @Get('today')
  @ApiOperation({ summary: "Get current user's today check-in status and live timer" })
  async getToday(@CurrentUser('id') userId: string) {
    return this.attendanceService.getTodayStatus(userId);
  }

  // 4. Monthly Calendar Grid
  @Get('my-calendar')
  @ApiOperation({ summary: 'Get monthly attendance calendar grid' })
  async getMyCalendar(
    @CurrentUser('id') userId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getMyCalendar(userId, month, year);
  }

  // 5. Submit Attendance Correction
  @Post('corrections')
  @ApiOperation({ summary: 'Submit attendance correction request' })
  async submitCorrection(
    @CurrentUser('id') userId: string,
    @Body() dto: CorrectionRequestDto,
  ) {
    return this.attendanceService.submitCorrection(userId, dto);
  }

  // 6. My Corrections
  @Get('corrections/my')
  @ApiOperation({ summary: 'List my submitted attendance corrections' })
  async getMyCorrections(@CurrentUser('id') userId: string) {
    return this.attendanceService.getMyCorrections(userId);
  }

  // 7. Manager: Team Attendance Today
  @Get('manager/team-today')
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Get manager team attendance today (or company-wide for HR/CEO)' })
  async getTeamToday(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.attendanceService.getTeamToday(userId, role);
  }

  // 8. Manager: Team Monthly Report
  @Get('manager/team-monthly')
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Get monthly attendance report for manager team' })
  async getTeamMonthly(
    @CurrentUser('id') userId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getTeamMonthly(userId, month, year);
  }

  // 9. Manager / HR: Pending Corrections
  @Get('manager/corrections')
  @Roles(Role.MANAGER, Role.HR)
  @ApiOperation({ summary: 'List pending attendance corrections for review' })
  async getPendingCorrections(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getPendingCorrections(userId, role, status);
  }

  // 10. Manager / HR: Approve or Reject Correction
  @Patch('manager/corrections/:id')
  @Roles(Role.MANAGER, Role.HR)
  @ApiOperation({ summary: 'Approve or Reject attendance correction' })
  async reviewCorrection(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewCorrectionDto,
  ) {
    return this.attendanceService.reviewCorrection(id, userId, dto);
  }

  // 11. HR: Daily Master Sheet
  @Get('hr/daily-sheet')
  @Roles(Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Company-wide daily attendance master sheet' })
  async getHrDailySheet(
    @Query('date') date?: string,
    @Query('dept') dept?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.attendanceService.getHrDailySheet({
      date,
      department: dept,
      status,
      page,
      limit,
      search,
    });
  }

  // 12. HR: Adjust Attendance
  @Put('hr/adjust')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'HR manual adjustment/override of employee attendance' })
  async hrAdjust(
    @CurrentUser('id') hrUserId: string,
    @Body() dto: HrAdjustAttendanceDto,
  ) {
    return this.attendanceService.hrAdjust(dto, hrUserId);
  }

  // 13. HR / CEO: Export Monthly Attendance
  @Get('hr/export')
  @Roles(Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Export monthly attendance to CSV for payroll' })
  async exportAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
  ) {
    const csv = await this.attendanceService.exportMonthlyCsv(month, year);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${month || 'cur'}-${year || 'cur'}.csv`);
    return res.send(csv);
  }

  // 14. HR: Sync Biometric Punch Logs
  @Post('hr/sync-biometric')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'Ingest biometric machine punch logs webhook' })
  async syncBiometric(@Body() dto: SyncBiometricDto) {
    return this.attendanceService.syncBiometric(dto);
  }

  // 15. Policies
  @Get('hr/policies')
  @ApiOperation({ summary: 'Get current office shift timings and grace period policies' })
  async getPolicies() {
    return this.attendanceService.getPolicies();
  }

  @Put('hr/policies')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'Update office shift timings and grace period policies' })
  async updatePolicy(@Body() dto: UpdatePolicyDto) {
    return this.attendanceService.updatePolicy(dto);
  }

  // 16. CEO: Executive Overview
  @Get('ceo/overview')
  @Roles(Role.CEO)
  @ApiOperation({ summary: 'Company-wide attendance KPI rate and executive analytics' })
  async getCeoOverview() {
    return this.attendanceService.getCeoOverview();
  }

  // 17. CEO: Department Breakdown
  @Get('ceo/department-stats')
  @Roles(Role.CEO)
  @ApiOperation({ summary: 'Department-wise attendance comparison rates' })
  async getCeoDepartmentStats() {
    return this.attendanceService.getCeoDepartmentStats();
  }
}
