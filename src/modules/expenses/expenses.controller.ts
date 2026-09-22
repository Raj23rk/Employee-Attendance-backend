import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { ExpensesService } from './expenses.service';
import { SubmitExpenseDto, ReviewExpenseDto } from './dto/expense.dto';
import {
  CreateDailyExpenseDto,
  UpdateDailyExpenseDto,
  DailyExpenseFilterDto,
} from './dto/daily-expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // ==========================================
  // EMPLOYEE REIMBURSEMENT CLAIMS
  // ==========================================

  @Post('submit')
  @ApiOperation({ summary: 'Submit expense reimbursement claim' })
  async submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitExpenseDto,
  ) {
    return this.expensesService.submitExpense(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get personal submitted expense claims' })
  async getMy(@CurrentUser('id') userId: string) {
    return this.expensesService.getMyExpenses(userId);
  }

  @Get('pending-approvals')
  @Roles(Role.MANAGER, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Pending expense claims from team / org' })
  async getPending(
    @CurrentUser('id') reviewerId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.expensesService.getPendingApprovals(reviewerId, role);
  }

  @Patch(':id/review')
  @Roles(Role.MANAGER, Role.HR)
  @ApiOperation({ summary: 'Approve, reject, or reimburse expense claim' })
  async review(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewExpenseDto,
  ) {
    return this.expensesService.reviewExpense(id, reviewerId, dto);
  }

  // ==========================================
  // ADMIN DAILY OFFICE EXPENSES & BILLS
  // ==========================================

  @Post('daily')
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR/CEO: Record daily office expense with bill/document details' })
  async createDaily(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDailyExpenseDto,
  ) {
    return this.expensesService.createDailyExpense(userId, dto);
  }

  @Get('daily')
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR/CEO: List daily expenses with date, category, and payment mode filters' })
  async getDaily(@Query() query: DailyExpenseFilterDto) {
    return this.expensesService.getDailyExpenses(query);
  }

  @Get('daily/:id')
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR/CEO: Get single daily expense record details' })
  async getDailyById(@Param('id') id: string) {
    return this.expensesService.getDailyExpenseById(id);
  }

  @Put('daily/:id')
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR/CEO: Update daily expense details or uploaded bill' })
  async updateDaily(
    @Param('id') id: string,
    @Body() dto: UpdateDailyExpenseDto,
  ) {
    return this.expensesService.updateDailyExpense(id, dto);
  }

  @Delete('daily/:id')
  @Roles(Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Admin/CEO: Delete daily expense entry' })
  async deleteDaily(@Param('id') id: string) {
    return this.expensesService.deleteDailyExpense(id);
  }

  // ==========================================
  // CEO EXECUTIVE MONTHLY EXPENSE OVERVIEW
  // ==========================================

  @Get('ceo/monthly-overview')
  @Roles(Role.CEO, Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'CEO/Admin: Executive monthly expense dashboard with daily breakdown and bill attachments' })
  async getCeoMonthlyOverview(
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const now = new Date();
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) : now.getMonth() + 1;
    return this.expensesService.getCeoMonthlyOverview(targetYear, targetMonth);
  }
}

