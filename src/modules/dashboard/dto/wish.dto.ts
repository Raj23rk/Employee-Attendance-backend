import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class SendCelebrationWishDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(['BIRTHDAY', 'WORK_ANNIVERSARY', 'NEW_JOINER', 'GENERAL'])
  occasionType?: string;

  @IsOptional()
  @IsString()
  reactionEmoji?: string;
}
