import { IsNotEmpty, IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class CreateAnnouncementDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  category: string; // Company, HR, Tech, Policy, Social

  @IsNotEmpty()
  @IsString()
  body: string;
}

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CreateTravelRequestDto {
  @IsNotEmpty()
  @IsString()
  purpose: string;

  @IsNotEmpty()
  @IsString()
  destination: string;

  @IsNotEmpty()
  @IsString()
  fromDate: string;

  @IsNotEmpty()
  @IsString()
  toDate: string;

  @IsOptional()
  @IsNumber()
  estimatedCost?: number;
}
