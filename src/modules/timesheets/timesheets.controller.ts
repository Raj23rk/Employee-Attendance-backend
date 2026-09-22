import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { TimesheetsService } from './timesheets.service';
import { SubmitTimesheetDto, ReviewTimesheetDto } from './dto/timesheet.dto';

@ApiTags('Timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly hours logged per project' })
  async getWeekly(
    @CurrentUser('id') userId: string,
    @Query('weekStartDate') weekStartDate: string,
  ) {
    return this.timesheetsService.getWeeklyTimesheet(userId, weekStartDate);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit weekly timesheet table for approval' })
  async submitTimesheet(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitTimesheetDto,
  ) {
    return this.timesheetsService.submitTimesheet(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Past submitted timesheet weeks & statuses' })
  async getHistory(@CurrentUser('id') userId: string) {
    return this.timesheetsService.getTimesheetHistory(userId);
  }

  @Get('manager/pending')
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Review timesheets submitted by team members' })
  async getPendingManagerTimesheets(
    @CurrentUser('id') managerId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.timesheetsService.getPendingManagerTimesheets(managerId, role);
  }

  @Patch('manager/:id/review')
  @Roles(Role.MANAGER, Role.HR)
  @ApiOperation({ summary: 'Approve or reject submitted timesheet' })
  async reviewTimesheet(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewTimesheetDto,
  ) {
    return this.timesheetsService.reviewTimesheet(id, reviewerId, dto);
  }
}
