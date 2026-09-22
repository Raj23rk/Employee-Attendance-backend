import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class UploadDocumentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  category: string; // Offer Letter, ID Proof, Degree Certificate, Medical/Maternity Proof, Payslip

  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}
