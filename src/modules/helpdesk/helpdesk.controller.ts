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
import { HelpdeskService } from './helpdesk.service';
import { CreateTicketDto, TicketReplyDto, UpdateTicketStatusDto } from './dto/ticket.dto';

@ApiTags('Helpdesk & Ticketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/helpdesk')
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Raise new support ticket (IT, HR, Payroll, Admin)' })
  async createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.helpdeskService.createTicket(userId, dto);
  }

  @Get('tickets/my')
  @ApiOperation({ summary: 'List tickets raised by current user' })
  async getMyTickets(@CurrentUser('id') userId: string) {
    return this.helpdeskService.getMyTickets(userId);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket details and conversation thread' })
  async getTicketById(@Param('id') id: string) {
    return this.helpdeskService.getTicketById(id);
  }

  @Post('tickets/:id/reply')
  @ApiOperation({ summary: 'Send reply message in ticket thread' })
  async addReply(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: TicketReplyDto,
  ) {
    return this.helpdeskService.addReply(id, userId, dto);
  }

  @Patch('tickets/:id/status')
  @Roles(Role.HR, Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Update ticket status (In Progress, Resolved, Closed)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.helpdeskService.updateStatus(id, dto);
  }
}
