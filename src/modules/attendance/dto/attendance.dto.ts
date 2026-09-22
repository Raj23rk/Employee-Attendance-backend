import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

export class CheckInDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CorrectionRequestDto {
  @IsNotEmpty()
  @IsString()
  targetDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  requestedCheckIn?: string;

  @IsOptional()
  @IsString()
  requestedCheckOut?: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class ReviewCorrectionDto {
  @IsNotEmpty()
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class HrAdjustAttendanceDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  date: string; // YYYY-MM-DD

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  checkInTime?: string; // HH:mm or ISO

  @IsOptional()
  @IsString()
  checkOutTime?: string; // HH:mm or ISO

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BiometricLogItemDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  timestamp: string;

  @IsNotEmpty()
  @IsEnum(['IN', 'OUT'])
  punchType: 'IN' | 'OUT';
}

export class SyncBiometricDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiometricLogItemDto)
  logs: BiometricLogItemDto[];
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  workStartTime?: string;

  @IsOptional()
  @IsString()
  workEndTime?: string;

  @IsOptional()
  @IsNumber()
  gracePeriodMinutes?: number;

  @IsOptional()
  @IsNumber()
  halfDayThresholdMinutes?: number;

  @IsOptional()
  @IsNumber()
  fullDayThresholdMinutes?: number;

  @IsOptional()
  @IsNumber()
  defaultBreakMinutes?: number;
}
