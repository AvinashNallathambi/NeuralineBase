import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ImmunizationsService } from './immunizations.service';
import { VaccineInventoryService } from './vaccine-inventory.service';
import { CreateImmunizationDto } from './dto/create-immunization.dto';
import { CreateVaccineInventoryDto, AdjustQuantityDto } from './dto/create-vaccine-inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Immunizations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('immunizations')
export class ImmunizationsController {
  constructor(
    private readonly service: ImmunizationsService,
    private readonly inventoryService: VaccineInventoryService,
  ) {}

  @Get('patient/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List immunizations for a patient' })
  async findByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.service.findByPatient(req.user.tenantId, patientId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get a single immunization record' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new immunization' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateImmunizationDto,
  ) {
    return this.service.create(req.user.tenantId, dto, req.user.id);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update an immunization record' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: Partial<CreateImmunizationDto>,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an immunization record (soft delete)' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(req.user.tenantId, id);
  }

  // ─── Vaccine Inventory ──────────────────────────────────────────

  @Get('inventory')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List all vaccine inventory items' })
  async getInventory(@Request() req: AuthenticatedRequest) {
    return this.inventoryService.findAll(req.user.tenantId);
  }

  @Get('inventory/expiring')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'List vaccines expiring soon' })
  async getExpiring(
    @Request() req: AuthenticatedRequest,
    @Query('days') days?: string,
  ) {
    return this.inventoryService.getExpiringSoon(req.user.tenantId, days ? Number(days) : 60);
  }

  @Get('inventory/low-stock')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'List vaccines with low stock' })
  async getLowStock(
    @Request() req: AuthenticatedRequest,
    @Query('threshold') threshold?: string,
  ) {
    return this.inventoryService.getLowStock(req.user.tenantId, threshold ? Number(threshold) : 10);
  }

  @Post('inventory')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a vaccine inventory item (new lot received)' })
  async createInventory(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateVaccineInventoryDto,
  ) {
    return this.inventoryService.create(req.user.tenantId, dto);
  }

  @Patch('inventory/:id')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a vaccine inventory item' })
  async updateInventory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: Partial<CreateVaccineInventoryDto>,
  ) {
    return this.inventoryService.update(req.user.tenantId, id, dto);
  }

  @Post('inventory/:id/adjust')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Adjust quantity on hand (positive to add, negative to subtract)' })
  async adjustQuantity(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: AdjustQuantityDto,
  ) {
    return this.inventoryService.adjustQuantity(req.user.tenantId, id, dto);
  }

  @Delete('inventory/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a vaccine inventory item' })
  async removeInventory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.inventoryService.remove(req.user.tenantId, id);
  }
}
