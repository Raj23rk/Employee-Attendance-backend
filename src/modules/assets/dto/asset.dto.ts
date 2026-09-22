import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ServiceRequestDto {
  @IsNotEmpty()
  @IsString()
  requestType: string; // REPAIR, REPLACEMENT, RETURN

  @IsNotEmpty()
  @IsString()
  description: string;
}
