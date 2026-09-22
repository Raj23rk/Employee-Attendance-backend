import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class SubmitFeedbackDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  category?: string; // WORKPLACE_CULTURE, INFRASTRUCTURE, PROCESSES, MANAGEMENT, SUGGESTION, OTHER

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  suggestions?: string;
}

export class UpdateFeedbackStatusDto {
  @IsNotEmpty()
  @IsEnum(['OPEN', 'REVIEWED', 'ACTION_TAKEN'])
  status: 'OPEN' | 'REVIEWED' | 'ACTION_TAKEN';

  @IsOptional()
  @IsString()
  ceoNotes?: string;
}
