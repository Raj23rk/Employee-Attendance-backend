import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { OrganizationService } from './organization.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@ApiTags('Directory & Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('directory')
  @ApiOperation({ summary: 'Search employee directory with filters (department, branch, search keyword)' })
  async getDirectory(
    @Query('search') search?: string,
    @Query('dept') dept?: string,
    @Query('branch') branch?: string,
    @Query('campus') campus?: string,
  ) {
    return this.orgService.searchDirectory({ search, department: dept, branch, campus });
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

  // Branch Endpoints
  @Get('branches')
  @ApiOperation({ summary: 'List all company branches with location and employee count' })
  async getBranches() {
    return this.orgService.getBranches();
  }

  @Get('branches/:id')
  @ApiOperation({ summary: 'Get single branch details by ID' })
  async getBranchById(@Param('id') id: string) {
    return this.orgService.getBranchById(id);
  }

  @Post('branches')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Create new company branch (HR/Admin/CEO)' })
  async createBranch(@Body() dto: CreateBranchDto) {
    return this.orgService.createBranch(dto);
  }

  @Put('branches/:id')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Update branch details and geolocation radius' })
  async updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.orgService.updateBranch(id, dto);
  }

  @Delete('branches/:id')
  @Roles(Role.HR, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Delete or deactivate branch' })
  async deleteBranch(@Param('id') id: string) {
    return this.orgService.deleteBranch(id);
  }
}

