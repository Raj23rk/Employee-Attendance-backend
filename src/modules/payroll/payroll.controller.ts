import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';
import {
  UpdateSalaryStructureDto,
  CreateSalaryIncrementDto,
  UpdateSalaryIncrementDto,
  GenerateMonthlyPayrollDto,
  GeneratePayslipDto,
} from './dto/payroll.dto';

@ApiTags('Payroll & Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ==================== EMPLOYEE SELF-SERVICE ====================

  @Get('salary-structure')
  @ApiOperation({ summary: 'Get current logged-in employee salary structure' })
  async getMySalaryStructure(@CurrentUser('id') userId: string) {
    return this.payrollService.getSalaryStructure(userId);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'List available monthly payslips for current logged-in user' })
  async getMyPayslips(@CurrentUser('id') userId: string) {
    return this.payrollService.getPayslips(userId);
  }

  @Get('payslips/:monthYear/download')
  @ApiOperation({ summary: 'Download / View monthly payslip HTML document' })
  async downloadPayslip(
    @Param('monthYear') monthYear: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const html = await this.payrollService.downloadPayslipHtml(userId, monthYear);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="payslip-${monthYear}.html"`);
    return res.send(html);
  }

  @Get('payslip/:id')
  @ApiOperation({ summary: 'Get details of a specific payslip by ID' })
  async getPayslipById(@Param('id') id: string) {
    return this.payrollService.getPayslipById(id);
  }

  // ==================== SALARY INCREMENTS (HR / GM / MD / ADMIN ONLY) ====================

  @Post('salary-increments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Create and apply a new salary increment for an employee' })
  async createSalaryIncrement(
    @Body() dto: CreateSalaryIncrementDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.payrollService.createSalaryIncrement(dto, adminId);
  }

  @Get('salary-increments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Get all salary increment history' })
  async getAllSalaryIncrements(@Query('userId') userId?: string) {
    return this.payrollService.getAllSalaryIncrements(userId);
  }

  @Get('salary-increments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Get specific salary increment record by ID' })
  async getSalaryIncrementById(@Param('id') id: string) {
    return this.payrollService.getSalaryIncrementById(id);
  }

  @Put('salary-increments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Update salary increment record' })
  async updateSalaryIncrement(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryIncrementDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.payrollService.updateSalaryIncrement(id, dto, adminId);
  }

  @Delete('salary-increments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Delete a salary increment record' })
  async deleteSalaryIncrement(@Param('id') id: string) {
    return this.payrollService.deleteSalaryIncrement(id);
  }

  // ==================== SALARY STRUCTURES (HR / GM / MD / ADMIN) ====================

  @Get('admin/salary-structures/branch-wise')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Get all employee salaries split & grouped by branch with attendance deductions' })
  async getSalaryStructuresBranchWise(@Query('monthYear') monthYear?: string) {
    return this.payrollService.getSalaryStructuresBranchWise(monthYear);
  }

  @Get('admin/salary-structures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: List all employee salary structures' })
  async getAllSalaryStructures(@Query('branch') branch?: string) {
    return this.payrollService.getAllSalaryStructures(branch);
  }

  @Put('admin/salary-structure/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Update or define employee salary structure' })
  async updateSalaryStructure(
    @Param('userId') userId: string,
    @Body() dto: UpdateSalaryStructureDto,
  ) {
    return this.payrollService.updateSalaryStructure(userId, dto);
  }

  // ==================== AUTOMATED ATTENDANCE-BASED PAYROLL GENERATION ====================

  @Get('admin/payslips/branch-wise')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Get all monthly payslips split & grouped by branch with totals' })
  async getPayslipsBranchWise(@Query('monthYear') monthYear?: string) {
    return this.payrollService.getPayslipsBranchWise(monthYear);
  }

  @Post('admin/generate-monthly-payslips')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({
    summary: 'HR / GM / MD: Automatically calculate attendance deductions & generate payslips for all employees for a month',
  })
  async generateMonthlyPayslips(@Body() dto: GenerateMonthlyPayrollDto) {
    return this.payrollService.generateMonthlyPayrollForAll(dto);
  }

  @Post('admin/generate-payslip')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Generate or override manual payslip for single employee' })
  async generateSinglePayslip(@Body() dto: GeneratePayslipDto) {
    return this.payrollService.generateManualPayslip(dto);
  }

  @Get('admin/payslips')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: List all generated employee payslips with filters' })
  async getAllAdminPayslips(
    @Query('monthYear') monthYear?: string,
    @Query('branch') branch?: string,
  ) {
    return this.payrollService.getAllPayslips(monthYear, branch);
  }

  @Get('admin/payslips/:userId/:monthYear/download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.GM, Role.MD, Role.HR_MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'HR / GM / MD: Download any employee monthly payslip' })
  async downloadEmployeePayslip(
    @Param('userId') userId: string,
    @Param('monthYear') monthYear: string,
    @Res() res: Response,
  ) {
    const html = await this.payrollService.downloadPayslipHtml(userId, monthYear);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="payslip-${userId}-${monthYear}.html"`);
    return res.send(html);
  }
}
