import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import { LearningService } from './learning.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Course.name, schema: CourseSchema }]),
  ],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService, MongooseModule],
})
export class LearningModule {}
