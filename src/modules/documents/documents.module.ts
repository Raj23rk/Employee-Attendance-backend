import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeeDocument, EmployeeDocumentSchema } from './schemas/document.schema';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmployeeDocument.name, schema: EmployeeDocumentSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService, MongooseModule],
})
export class DocumentsModule {}
