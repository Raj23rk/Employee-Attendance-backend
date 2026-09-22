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
import { LeavesService } from './leaves.service';
import { ApplyLeaveDto, ReviewLeaveDto } from './dto/leaves.dto';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // 1. Get Balances
  @Get('balances')
  @ApiOperation({ summary: 'Get current user leave balances (Maternity for females, 3-day Paternity for males)' })
  async getBalances(@CurrentUser('id') userId: string) {
    return this.leavesService.getBalances(userId);
  }

  // 2. Apply for Leave
  @Post('apply')
  @ApiOperation({ summary: 'Apply for leave (enforces Maternity & 3-day Paternity policy)' })
  async applyLeave(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyLeaveDto,
  ) {
    return this.leavesService.applyLeave(userId, dto);
  }

  // 3. My Leave History
  @Get('my-history')
  @ApiOperation({ summary: 'Get personal submitted leave applications' })
  async getMyHistory(@CurrentUser('id') userId: string) {
    return this.leavesService.getMyHistory(userId);
  }

  // 4. Cancel Leave
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel pending or upcoming leave' })
  async cancelLeave(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leavesService.cancelLeave(id, userId);
  }

  // 5. Manager: Team Leave Requests
  @Get('manager/team-requests')
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'List pending leave applications from reportees' })
  async getTeamRequests(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.leavesService.getTeamRequests(userId, role);
  }

  // 6. Manager / HR: Review Leave
  @Patch('manager/:id/review')
  @Roles(Role.MANAGER, Role.HR)
  @ApiOperation({ summary: 'Approve or Reject leave application' })
  async reviewLeave(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leavesService.reviewLeave(id, userId, dto);
  }

  // 7. Team / Org Public Leave Calendar
  @Get('calendar')
  @ApiOperation({ summary: 'Team/Company public leave calendar' })
  async getLeaveCalendar(
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.leavesService.getLeaveCalendar(month, year);
  }
}
