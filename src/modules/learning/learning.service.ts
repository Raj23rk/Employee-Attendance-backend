import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';

@Injectable()
export class LearningService {
  constructor(@InjectModel(Course.name) private courseModel: Model<CourseDocument>) {}

  async getCourses(userId: string) {
    let courses = await this.courseModel.find().exec();

    if (courses.length === 0) {
      // Seed mandatory & skill courses
      courses = [
        await this.courseModel.create({
          title: 'POSH Compliance & Safe Workplace 2026',
          category: 'Compliance',
          isMandatory: true,
          duration: '1.5 hours',
          description: 'Mandatory prevention of sexual harassment training for all staff.',
          thumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
        }),
        await this.courseModel.create({
          title: 'Information Security & Data Protection Policies',
          category: 'Compliance',
          isMandatory: true,
          duration: '2 hours',
          description: 'Best security practices for handling corporate credentials and sensitive data.',
          thumbnailUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400',
        }),
        await this.courseModel.create({
          title: 'Modern Architecture with NestJS & MongoDB',
          category: 'Technical',
          isMandatory: false,
          duration: '6 hours',
          description: 'Master enterprise backend design patterns, Guards, and Mongoose indexing.',
          thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400',
        }),
      ];
    }

    const withUserProgress = courses.map((c) => {
      const enrollment = c.enrollments?.find((e) => e.userId.toString() === userId);
      return {
        id: c._id,
        title: c.title,
        category: c.category,
        isMandatory: c.isMandatory,
        duration: c.duration,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        progress: enrollment ? enrollment.progress : 0,
        completed: enrollment ? enrollment.progress === 100 : false,
      };
    });

    return { success: true, count: withUserProgress.length, data: withUserProgress };
  }

  async updateProgress(courseId: string, userId: string, progress: number) {
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const uId = new Types.ObjectId(userId);
    let enrollment = course.enrollments.find((e) => e.userId.toString() === userId);

    if (!enrollment) {
      enrollment = {
        userId: uId,
        progress: Math.min(100, Math.max(0, progress)),
        completedAt: progress >= 100 ? new Date() : null,
      };
      course.enrollments.push(enrollment);
    } else {
      enrollment.progress = Math.min(100, Math.max(0, progress));
      if (progress >= 100 && !enrollment.completedAt) {
        enrollment.completedAt = new Date();
      }
    }

    await course.save();

    return {
      success: true,
      message: 'Course progress updated',
      data: { courseId, progress: enrollment.progress },
    };
  }
}
