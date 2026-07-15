import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { ROLE_DEFINITIONS, PERMISSION_MODULES } from './role-permissions';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Users & Access Control')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── User CRUD ────────────────────────────────────────────────────

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users in the tenant' })
  async findAll(@Request() req: AuthenticatedRequest) {
    const users = await this.usersService.findAll(req.user.tenantId);
    return users.map((u) => this.usersService.sanitize(u));
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a single user by ID' })
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.usersService.findOne(req.user.tenantId, id);
    return this.usersService.sanitize(user);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create / invite a new user' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: string;
      phone?: string;
      department?: string;
    },
  ) {
    const user = await this.usersService.create(req.user.tenantId, body);
    return this.usersService.sanitize(user);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a user (name, email, phone, department)' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      department: string;
    }>,
  ) {
    const user = await this.usersService.update(req.user.tenantId, id, body);
    return this.usersService.sanitize(user);
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({ summary: 'Change a user role' })
  async changeRole(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { role: string },
  ) {
    const user = await this.usersService.changeRole(req.user.tenantId, id, body.role);
    return this.usersService.sanitize(user);
  }

  @Patch(':id/toggle-active')
  @Roles('admin')
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  async toggleActive(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.usersService.toggleActive(req.user.tenantId, id);
    return this.usersService.sanitize(user);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.usersService.remove(req.user.tenantId, id);
  }

  // ─── Access Control ───────────────────────────────────────────────

  @Get('roles/definitions')
  @ApiOperation({ summary: 'Get all role definitions with permissions' })
  async getRoleDefinitions() {
    return ROLE_DEFINITIONS;
  }

  @Get('roles/modules')
  @ApiOperation({ summary: 'Get all permission modules' })
  async getPermissionModules() {
    return PERMISSION_MODULES;
  }
}
