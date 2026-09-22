import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmployeeDocument, EmployeeDocumentRecord } from './schemas/document.schema';
import { UploadDocumentDto } from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(EmployeeDocument.name)
    private docModel: Model<EmployeeDocumentRecord>,
  ) {}

  async getMyDocuments(userId: string) {
    let docs = await this.docModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    if (docs.length === 0) {
      // Create initial sample document
      docs = [
        await this.docModel.create({
          userId: new Types.ObjectId(userId),
          title: 'Employment Offer Letter & Terms',
          category: 'Offer Letter',
          fileUrl: 'https://docs.wegrow.edu.in/letters/EMP-OFFER.pdf',
          fileType: 'PDF',
          fileSize: 1048576,
        }),
      ];
    }

    return { success: true, count: docs.length, data: docs };
  }

  async saveDocumentRecord(userId: string, dto: UploadDocumentDto) {
    const doc = await this.docModel.create({
      ...dto,
      userId: new Types.ObjectId(userId),
    });

    return { success: true, message: 'Document uploaded successfully', data: doc };
  }
}
