import { Controller, Get, Post, Put, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';
import { UpdateSalaryStructureDto, GeneratePayslipDto } from './dto/payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('salary-structure')
  @ApiOperation({ summary: 'Get current user salary structure (Gross, Net, Basic, HRA, PF, etc.)' })
  async getSalaryStructure(@CurrentUser('id') userId: string) {
    return this.payrollService.getSalaryStructure(userId);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'List available monthly payslips for current user' })
  async getPayslips(@CurrentUser('id') userId: string) {
    return this.payrollService.getPayslips(userId);
  }

  @Get('payslips/:monthYear/download')
  @ApiOperation({ summary: 'Download monthly payslip document' })
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

  // --- ADMIN / HR / CEO PAYROLL MANAGEMENT ---

  @Get('admin/salary-structures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR: List all employee salary structures' })
  async getAllSalaryStructures() {
    return this.payrollService.getAllSalaryStructures();
  }

  @Put('admin/salary-structure/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR: Update or define employee salary structure' })
  async updateSalaryStructure(
    @Param('userId') userId: string,
    @Body() dto: UpdateSalaryStructureDto,
  ) {
    return this.payrollService.updateSalaryStructure(userId, dto);
  }

  @Post('admin/generate-payslip')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR: Generate or update monthly payslip for employee' })
  async generatePayslip(@Body() dto: GeneratePayslipDto) {
    return this.payrollService.generatePayslip(dto);
  }

  @Get('admin/payslips')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'Admin/HR/CEO: List all generated employee payslips' })
  async getAllPayslips(@Query('monthYear') monthYear?: string) {
    return this.payrollService.getAllPayslips(monthYear);
  }
}

