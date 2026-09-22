import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LearningService } from './learning.service';

@ApiTags('Learning & Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('courses')
  @ApiOperation({ summary: 'Get enrolled mandatory (POSH, Compliance) & optional courses' })
  async getCourses(@CurrentUser('id') userId: string) {
    return this.learningService.getCourses(userId);
  }

  @Patch('courses/:id/progress')
  @ApiOperation({ summary: 'Update course completion percentage' })
  async updateProgress(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('progress') progress: number,
  ) {
    return this.learningService.updateProgress(id, userId, Number(progress) || 0);
  }
}
