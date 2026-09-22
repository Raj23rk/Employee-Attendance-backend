import { IsString, IsEmail, IsNotEmpty, MinLength, IsOptional, Matches } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // Accepts email or employeeId

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@wegrow\.edu\.in$/i, {
    message: 'Only official @wegrow.edu.in email addresses are allowed',
  })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  role?: any; // Role enum (EMPLOYEE, MANAGER, HR, CEO)

  @IsOptional()
  gender?: any; // Gender enum (MALE, FEMALE, OTHER)

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dateOfJoining?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };

  @IsOptional()
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
}
