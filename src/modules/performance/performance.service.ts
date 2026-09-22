import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class PerformanceService {
  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

  async getGoals(userId: string) {
    let goals = await this.goalModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    if (goals.length === 0) {
      // Seed default goals if none exist
      goals = [
        await this.goalModel.create({
          userId: new Types.ObjectId(userId),
          title: 'Deliver Attendance Backend API Specification',
          quarter: 'Q3-2026',
          progress: 85,
          status: 'IN_PROGRESS',
        }),
        await this.goalModel.create({
          userId: new Types.ObjectId(userId),
          title: 'Complete NestJS & MongoDB Security Hardening',
          quarter: 'Q3-2026',
          progress: 60,
          status: 'IN_PROGRESS',
        }),
      ];
    }

    return { success: true, count: goals.length, data: goals };
  }

  async getReviews(userId: string) {
    let reviews = await this.reviewModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('reviewerId', 'name email role designation')
      .sort({ createdAt: -1 })
      .exec();

    if (reviews.length === 0) {
      reviews = [
        {
          cycle: 'Mid-Year Review 2026',
          rating: 4.5,
          feedback: 'Exceptional ownership on campus tech platforms. Consistently delivers robust solutions with high quality.',
          strengths: 'Fast execution, clean code architecture, reliable pair programming',
          improvements: 'Continue driving cross-departmental documentation',
        } as any,
      ];
    }

    return { success: true, count: reviews.length, data: reviews };
  }
}
