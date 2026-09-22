import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { HelpdeskService } from './helpdesk.service';
import { HelpdeskController } from './helpdesk.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
  ],
  controllers: [HelpdeskController],
  providers: [HelpdeskService],
  exports: [HelpdeskService, MongooseModule],
})
export class HelpdeskModule {}
