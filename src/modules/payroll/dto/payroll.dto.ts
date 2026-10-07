import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class UpdateSalaryStructureDto {
  @IsOptional()
  @IsNumber()
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  grossSalary?: number;

  @IsOptional()
  @IsNumber()
  netSalary?: number;

  @IsOptional()
  @IsNumber()
  basic?: number;

  @IsOptional()
  @IsNumber()
  hra?: number;

  @IsOptional()
  @IsNumber()
  specialAllowance?: number;

  @IsOptional()
  @IsNumber()
  conveyanceAllowance?: number;

  @IsOptional()
  @IsNumber()
  otherAllowances?: number;

  @IsOptional()
  @IsNumber()
  pfDeduction?: number;

  @IsOptional()
  @IsNumber()
  esiDeduction?: number;

  @IsOptional()
  @IsNumber()
  tdsDeduction?: number;

  @IsOptional()
  @IsNumber()
  professionalTax?: number;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSalaryIncrementDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsNumber()
  newSalary: number;

  @IsOptional()
  @IsNumber()
  incrementAmount?: number;

  @IsOptional()
  @IsNumber()
  incrementPercentage?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSalaryIncrementDto {
  @IsOptional()
  @IsNumber()
  newSalary?: number;

  @IsOptional()
  @IsNumber()
  incrementAmount?: number;

  @IsOptional()
  @IsNumber()
  incrementPercentage?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class GenerateMonthlyPayrollDto {
  @IsOptional()
  @IsString()
  monthYear?: string; // e.g. "October 2026" or "2026-10"

  @IsOptional()
  @IsNumber()
  month?: number; // 1-12

  @IsOptional()
  @IsNumber()
  year?: number; // e.g. 2026

  @IsOptional()
  @IsString()
  branch?: string;
}

export class GeneratePayslipDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  monthYear: string; // e.g. "October 2026"

  @IsOptional()
  @IsNumber()
  grossPay?: number;

  @IsOptional()
  @IsNumber()
  netPay?: number;

  @IsOptional()
  @IsNumber()
  totalDeductions?: number;

  @IsOptional()
  @IsNumber()
  workingDays?: number;

  @IsOptional()
  @IsNumber()
  paidDays?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
