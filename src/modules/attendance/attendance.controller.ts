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
  ApplyPermissionDto,
  ReviewPermissionDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // 1. Check In
  @Post('check-in')
  @ApiOperation({ summary: 'Punch In with GPS Location & 9:40 AM Shift / 9:45 Grace Detection' })
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
  @ApiOperation({ summary: 'Punch Out with GPS Location & 7:00 PM Target Calculation' })
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
  @ApiOperation({ summary: "Get current user's today check-in status, late arrivals, branch, and live timer" })
  async getToday(@CurrentUser('id') userId: string) {
    return this.attendanceService.getTodayStatus(userId);
  }

  // 4. Monthly Calendar Grid
  @Get('my-calendar')
  @ApiOperation({ summary: 'Get monthly attendance calendar grid with late arrival & deduction flags' })
  async getMyCalendar(
    @CurrentUser('id') userId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getMyCalendar(userId, month, year);
  }

  // 5. Apply Monthly Permission (Max 2 hours/month allowed)
  @Post(['permissions', 'permissions/apply'])
  @ApiOperation({ summary: 'Apply for monthly permission (Max 2 hours per month; excess triggers half-day deduction)' })
  async applyPermission(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyPermissionDto,
  ) {
    return this.attendanceService.applyPermission(userId, dto);
  }

  // 6. My Permissions & Quota
  @Get(['permissions', 'permissions/my'])
  @ApiOperation({ summary: 'Get my monthly permission applications and remaining hours out of 2 hrs limit' })
  async getMyPermissions(
    @CurrentUser('id') userId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getMyPermissions(userId, month, year);
  }

  // 7. Manager / HR: View Team Permission Requests
  @Get('permissions/team')
  @Roles(Role.MANAGER, Role.TEAM_MANAGER, Role.HR, Role.HR_MANAGER, Role.CEO, Role.ADMIN, Role.SYSTEM_ADMIN, Role.MD, Role.GM, Role.EXECUTIVE)
  @ApiOperation({ summary: 'List team permission requests for review (with branch filter)' })
  async getTeamPermissions(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('branch') branch?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getTeamPermissions(userId, role, branch, status);
  }

  // 8. Manager / HR: Review Permission Request
  @Patch(['permissions/:id/review', 'permissions/:id'])
  @Roles(Role.MANAGER, Role.TEAM_MANAGER, Role.HR, Role.HR_MANAGER, Role.CEO, Role.ADMIN, Role.SYSTEM_ADMIN, Role.MD, Role.GM, Role.EXECUTIVE)
  @ApiOperation({ summary: 'Approve or Reject permission request (Applies half-day deduction if over 2 hours limit)' })
  async reviewPermission(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewPermissionDto,
  ) {
    return this.attendanceService.reviewPermission(id, userId, dto);
  }

  // 9. Submit Attendance Correction
  @Post('corrections')
  @ApiOperation({ summary: 'Submit attendance correction request' })
  async submitCorrection(
    @CurrentUser('id') userId: string,
    @Body() dto: CorrectionRequestDto,
  ) {
    return this.attendanceService.submitCorrection(userId, dto);
  }

  // 10. My Corrections
  @Get('corrections/my')
  @ApiOperation({ summary: 'List my submitted attendance corrections' })
  async getMyCorrections(@CurrentUser('id') userId: string) {
    return this.attendanceService.getMyCorrections(userId);
  }

  // 11. Manager: Team Attendance Today
  @Get('manager/team-today')
  @Roles(Role.MANAGER, Role.TEAM_MANAGER, Role.HR, Role.HR_MANAGER, Role.CEO, Role.ADMIN, Role.SYSTEM_ADMIN, Role.MD, Role.GM, Role.EXECUTIVE)
  @ApiOperation({ summary: 'Get manager team attendance today (with optional branch filter)' })
  async getTeamToday(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('branch') branch?: string,
  ) {
    return this.attendanceService.getTeamToday(userId, role, branch);
  }

  // 12. Manager: Team Monthly Report
  @Get('manager/team-monthly')
  @Roles(Role.MANAGER, Role.TEAM_MANAGER, Role.HR, Role.HR_MANAGER, Role.CEO, Role.ADMIN, Role.SYSTEM_ADMIN, Role.MD, Role.GM, Role.EXECUTIVE)
  @ApiOperation({ summary: 'Get monthly attendance report for manager team' })
  async getTeamMonthly(
    @CurrentUser('id') userId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getTeamMonthly(userId, month, year);
  }

  // 13. Manager / HR: Pending Corrections
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

  // 14. Manager / HR: Approve or Reject Correction
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

  // 15. HR: Daily Master Sheet with Branch Filter
  @Get('hr/daily-sheet')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Company-wide daily attendance master sheet with branch filter' })
  async getHrDailySheet(
    @Query('date') date?: string,
    @Query('dept') dept?: string,
    @Query('branch') branch?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.attendanceService.getHrDailySheet({
      date,
      department: dept,
      branch,
      status,
      page,
      limit,
      search,
    });
  }

  // 16. HR: Adjust Attendance
  @Put('hr/adjust')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'HR manual adjustment/override of employee attendance' })
  async hrAdjust(
    @CurrentUser('id') hrUserId: string,
    @Body() dto: HrAdjustAttendanceDto,
  ) {
    return this.attendanceService.hrAdjust(dto, hrUserId);
  }

  // 17. HR / CEO: Export Monthly Attendance with Branch Filter
  @Get('hr/export')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Export monthly attendance to CSV for payroll with branch filter' })
  async exportAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('branch') branch: string,
    @Res() res: Response,
  ) {
    const csv = await this.attendanceService.exportMonthlyCsv(month, year, branch);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${branch || 'all'}-${month || 'cur'}-${year || 'cur'}.csv`);
    return res.send(csv);
  }

  // 18. HR: Sync Biometric Punch Logs
  @Post('hr/sync-biometric')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'Ingest biometric machine punch logs webhook' })
  async syncBiometric(@Body() dto: SyncBiometricDto) {
    return this.attendanceService.syncBiometric(dto);
  }

  // 19. Policies
  @Get('hr/policies')
  @ApiOperation({ summary: 'Get current office shift timings (9:40 AM check-in, 9:45 grace, 7:00 PM checkout, 2hr permission)' })
  async getPolicies() {
    return this.attendanceService.getPolicies();
  }

  @Put('hr/policies')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Update office shift timings and grace period policies' })
  async updatePolicy(@Body() dto: UpdatePolicyDto) {
    return this.attendanceService.updatePolicy(dto);
  }

  // 20. CEO: Executive Overview with Branch Breakdown
  @Get('ceo/overview')
  @Roles(Role.CEO, Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Company-wide attendance KPI rate and multi-branch analytics' })
  async getCeoOverview(@Query('branch') branch?: string) {
    return this.attendanceService.getCeoOverview(branch);
  }

  // 21. CEO: Department Breakdown
  @Get('ceo/department-stats')
  @Roles(Role.CEO, Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Department-wise attendance comparison rates' })
  async getCeoDepartmentStats(@Query('branch') branch?: string) {
    return this.attendanceService.getCeoDepartmentStats(branch);
  }

  // 22. Daily Multi-Branch Irregularities Report (Late Comers, Half-Day, Approved Leave, Full-Day Absentees)
  @Get('reports/daily-branch-irregularities')
  @Roles(Role.HR, Role.HR_MANAGER, Role.GM, Role.MD, Role.CEO, Role.ADMIN, Role.MANAGER, Role.EXECUTIVE)
  @ApiOperation({
    summary: 'Daywise branch report: Late comers, half-day leaves, full-day leaves, and absentees',
  })
  async getDailyBranchIrregularitiesReport(
    @Query('date') date?: string,
    @Query('branch') branch?: string,
  ) {
    return this.attendanceService.getDailyBranchIrregularitiesReport(date, branch);
  }

  // 23. Individual Monthly Attendance & Biometric Audit Log (JSON or HTML)
  @Get(['reports/individual/:id', 'reports/employee/:id'])
  @ApiOperation({
    summary:
      'Get individual monthly attendance report & biometric audit log for specific employee (JSON or HTML)',
  })
  async getIndividualReport(
    @Param('id') id: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.attendanceService.getIndividualMonthlyReport(id, month, year);
    if (format === 'html' && res) {
      const html = this.attendanceService.generateIndividualReportHtml(data);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    if (res) {
      return res.json(data);
    }
    return data;
  }

  // 24. Individual Monthly Attendance Report for Current User or Query
  @Get('reports/individual')
  @ApiOperation({
    summary:
      'Get individual monthly attendance report for current user or query userId/employeeId',
  })
  async getMyIndividualReport(
    @CurrentUser('id') currentUserId: string,
    @Query('userId') queryUserId?: string,
    @Query('employeeId') queryEmployeeId?: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const targetIdentifier = queryUserId || queryEmployeeId || currentUserId;
    const data = await this.attendanceService.getIndividualMonthlyReport(
      targetIdentifier,
      month,
      year,
    );
    if (format === 'html' && res) {
      const html = this.attendanceService.generateIndividualReportHtml(data);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    if (res) {
      return res.json(data);
    }
    return data;
  }

  // 25. Individual Monthly Attendance Report HTML Direct View / Print
  @Get(['reports/individual-html/:id', 'reports/employee/:id/html'])
  @ApiOperation({
    summary:
      'Render printable/PDF-ready HTML monthly attendance statement for an employee',
  })
  async getIndividualReportHtml(
    @Param('id') id: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
  ) {
    const data = await this.attendanceService.getIndividualMonthlyReport(id, month, year);
    const html = this.attendanceService.generateIndividualReportHtml(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // 26. Bulk Monthly Attendance Report (JSON or HTML)
  @Get('reports/bulk')
  @Roles(Role.HR, Role.HR_MANAGER, Role.GM, Role.MD, Role.CEO, Role.ADMIN, Role.MANAGER, Role.EXECUTIVE)
  @ApiOperation({
    summary:
      'Get bulk monthly attendance reports for all employees or filtered by branch/department',
  })
  async getBulkReport(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('branch') branch?: string,
    @Query('department') department?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.attendanceService.getBulkMonthlyReport(
      month,
      year,
      branch,
      department,
    );
    if (format === 'html' && res) {
      const html = this.attendanceService.generateBulkReportHtml(data);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    if (res) {
      return res.json(data);
    }
    return data;
  }

  // 27. Bulk Monthly Attendance Report HTML Direct View / Print
  @Get('reports/bulk-html')
  @Roles(Role.HR, Role.HR_MANAGER, Role.GM, Role.MD, Role.CEO, Role.ADMIN, Role.MANAGER, Role.EXECUTIVE)
  @ApiOperation({
    summary:
      'Render bulk printable/PDF-ready HTML monthly attendance statements for all employees',
  })
  async getBulkReportHtml(
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('branch') branch: string,
    @Query('department') department: string,
    @Res() res: Response,
  ) {
    const data = await this.attendanceService.getBulkMonthlyReport(
      month,
      year,
      branch,
      department,
    );
    const html = this.attendanceService.generateBulkReportHtml(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
}
