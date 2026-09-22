import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/document.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents (Offer Letter, ID proofs, Certificates)' })
  async getDocuments(@CurrentUser('id') userId: string) {
    return this.documentsService.getMyDocuments(userId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload supporting document metadata / URL' })
  async upload(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.saveDocumentRecord(userId, dto);
  }
}
