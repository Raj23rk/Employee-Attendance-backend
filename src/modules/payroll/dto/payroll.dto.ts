import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateSalaryStructureDto {
  @IsNumber()
  grossSalary: number;

  @IsNumber()
  netSalary: number;

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
}

export class GeneratePayslipDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  monthYear: string; // e.g., "September 2026"

  @IsNumber()
  grossPay: number;

  @IsNumber()
  netPay: number;

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
