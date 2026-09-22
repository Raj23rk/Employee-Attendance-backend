import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { TicketPriority, TicketStatus } from '../../../common/enums/task-status.enum';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  category: string; // IT, HR, Payroll, Admin, Facility

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

export class TicketReplyDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class UpdateTicketStatusDto {
  @IsNotEmpty()
  @IsEnum(TicketStatus)
  status: TicketStatus;
}
