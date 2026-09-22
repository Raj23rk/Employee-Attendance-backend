import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeaveType } from '../../../common/enums/leave-type.enum';

export class ApplyLeaveDto {
  @IsNotEmpty()
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsNotEmpty()
  @IsString()
  fromDate: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  toDate: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  days: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  documentUrl?: string; // E.g. Doctor's certificate or maternity proof
}

export class ReviewLeaveDto {
  @IsNotEmpty()
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;
}
