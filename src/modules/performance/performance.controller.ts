import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PerformanceService } from './performance.service';

@ApiTags('Performance & OKRs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('goals')
  @ApiOperation({ summary: 'List personal OKRs / goals and percentage progress' })
  async getGoals(@CurrentUser('id') userId: string) {
    return this.performanceService.getGoals(userId);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Monthly check-in & appraisal review notes and ratings' })
  async getReviews(@CurrentUser('id') userId: string) {
    return this.performanceService.getReviews(userId);
  }
}
