import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';

@ApiTags('Directory & Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('directory')
  @ApiOperation({ summary: 'Search employee directory with filters (department, search keyword)' })
  async getDirectory(
    @Query('search') search?: string,
    @Query('dept') dept?: string,
    @Query('campus') campus?: string,
  ) {
    return this.orgService.searchDirectory({ search, department: dept, campus });
  }

  @Get('organization/tree')
  @ApiOperation({ summary: 'Organization hierarchical reporting chart (Director -> Leads -> Staff)' })
  async getOrgTree() {
    return this.orgService.getOrgTree();
  }

  @Get('organization/departments')
  @ApiOperation({ summary: 'List departments and team lead information' })
  async getDepartments() {
    return this.orgService.getDepartments();
  }
}
