import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DailyHourDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsNumber()
  hours: number;
}

export class ProjectTimesheetRowDto {
  @IsNotEmpty()
  @IsString()
  project: string;

  @IsOptional()
  @IsString()
  taskDescription?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyHourDto)
  entries: DailyHourDto[];
}

export class SubmitTimesheetDto {
  @IsNotEmpty()
  @IsString()
  weekStartDate: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  weekEndDate: string; // YYYY-MM-DD

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectTimesheetRowDto)
  rows: ProjectTimesheetRowDto[];
}

export class ReviewTimesheetDto {
  @IsNotEmpty()
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  remarks?: string;
}
