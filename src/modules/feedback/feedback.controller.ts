import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';

@ApiTags('Open Feedback (Confidential)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // 1. Submit open feedback (All Employees)
  @Post()
  @ApiOperation({
    summary: 'Submit confidential open feedback (Submitter identity is hidden from everyone except CEO)',
  })
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submitFeedback(userId, dto);
  }

  // 2. View all submitted feedback (Strictly CEO Only)
  @Get()
  @Roles(Role.CEO)
  @ApiOperation({
    summary: 'CEO Only: View all employee feedback with submitter identities',
  })
  async getAllFeedbackForCeo() {
    return this.feedbackService.getAllFeedbackForCeo();
  }

  // 3. View my own submitted feedback (Employee self-history)
  @Get('my')
  @ApiOperation({ summary: 'View my own past submitted feedback history' })
  async getMySubmittedFeedback(@CurrentUser('id') userId: string) {
    return this.feedbackService.getMySubmittedFeedback(userId);
  }

  // 4. Update status & CEO internal notes (CEO Only)
  @Patch(':id')
  @Roles(Role.CEO)
  @ApiOperation({ summary: 'CEO Only: Review and update feedback status/notes' })
  async updateFeedbackStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    return this.feedbackService.updateFeedbackStatus(id, dto);
  }
}
