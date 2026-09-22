import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetsService } from './assets.service';
import { ServiceRequestDto } from './dto/asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('my')
  @ApiOperation({ summary: 'List assigned company assets (Laptop, Monitor, ID Card)' })
  async getMyAssets(@CurrentUser('id') userId: string) {
    return this.assetsService.getMyAssets(userId);
  }

  @Post(':id/service-request')
  @ApiOperation({ summary: 'Request repair or replacement for an assigned asset' })
  async requestService(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ServiceRequestDto,
  ) {
    return this.assetsService.createServiceRequest(id, userId, dto);
  }
}
