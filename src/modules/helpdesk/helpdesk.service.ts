import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from './schemas/ticket.schema';
import { CreateTicketDto, TicketReplyDto, UpdateTicketStatusDto } from './dto/ticket.dto';
import { TicketStatus } from '../../common/enums/task-status.enum';

@Injectable()
export class HelpdeskService {
  constructor(@InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>) {}

  async createTicket(creatorId: string, dto: CreateTicketDto) {
    const ticket = await this.ticketModel.create({
      ...dto,
      creatorId: new Types.ObjectId(creatorId),
      status: TicketStatus.OPEN,
    });

    return { success: true, message: 'Support ticket raised', data: ticket };
  }

  async getMyTickets(userId: string) {
    const list = await this.ticketModel
      .find({ creatorId: new Types.ObjectId(userId) })
      .populate('assignedToId', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getTicketById(id: string) {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('creatorId', 'name employeeId department avatarUrl')
      .populate('assignedToId', 'name employeeId')
      .populate('replies.senderId', 'name avatarUrl role')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return { success: true, data: ticket };
  }

  async addReply(ticketId: string, senderId: string, dto: TicketReplyDto) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.replies.push({
      senderId: new Types.ObjectId(senderId),
      message: dto.message,
      attachmentUrl: dto.attachmentUrl || '',
    } as any);

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    await ticket.save();

    return { success: true, message: 'Reply sent', data: ticket };
  }

  async updateStatus(ticketId: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.status = dto.status;
    await ticket.save();

    return { success: true, message: `Ticket status updated to ${dto.status}`, data: ticket };
  }
}
