import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class SubmitExpenseDto {
  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @IsNotEmpty()
  @IsString()
  date: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  billUrl?: string;
}

export class ReviewExpenseDto {
  @IsNotEmpty()
  @IsEnum(['APPROVED', 'REJECTED', 'REIMBURSED'])
  status: 'APPROVED' | 'REJECTED' | 'REIMBURSED';

  @IsOptional()
  @IsString()
  remarks?: string;
}
