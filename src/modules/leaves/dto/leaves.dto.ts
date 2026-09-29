import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
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
  documentUrl?: string; // Supporting document / Medical certificate

  @IsOptional()
  @IsString()
  medicalCertificateUrl?: string; // Mandatory for SICK leave, otherwise converted to LOP
}

export class ReviewLeaveDto {
  @IsNotEmpty()
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsBoolean()
  verifyMedicalCertificate?: boolean;

  @IsOptional()
  @IsBoolean()
  markAsLop?: boolean; // HR can force mark as LOP if invalid proof
}
