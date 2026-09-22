import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateProfileDto, ChangePasswordDto } from './dto/users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update personal profile details' })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(userId, dto);
  }

  @Put('me/change-password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.CEO)
  @ApiOperation({ summary: 'List all employees with search and department filter (Admin, HR, CEO)' })
  async findAll(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll({ search, department, page, limit });
  }

  @Post()
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Onboard/Register new employee and assign role (Admin, HR, Manager, CEO)' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
