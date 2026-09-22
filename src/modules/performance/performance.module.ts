import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Goal, GoalSchema } from './schemas/goal.schema';
import { Review, ReviewSchema } from './schemas/review.schema';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Goal.name, schema: GoalSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService, MongooseModule],
})
export class PerformanceModule {}
