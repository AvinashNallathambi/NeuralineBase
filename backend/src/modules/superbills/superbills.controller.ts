import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SuperbillsService } from './superbills.service';
import { CreateSuperbillDto } from './dto/create-superbill.dto';
import { UpdateSuperbillDto } from './dto/update-superbill.dto';
import { SuperbillStatus } from './entities/superbill.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('superbills')
@UseGuards(JwtAuthGuard)
export class SuperbillsController {
  constructor(private readonly superbillsService: SuperbillsService) {}

  @Post()
  create(@Body() createSuperbillDto: CreateSuperbillDto) {
    return this.superbillsService.create(createSuperbillDto);
  }

  @Get()
  findAll(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: SuperbillStatus,
  ) {
    if (patientId) {
      return this.superbillsService.findByPatient(patientId);
    }
    if (providerId) {
      return this.superbillsService.findByProvider(providerId);
    }
    if (status) {
      return this.superbillsService.findByStatus(status);
    }
    return this.superbillsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.superbillsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSuperbillDto: UpdateSuperbillDto,
  ) {
    return this.superbillsService.update(id, updateSuperbillDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.superbillsService.remove(id);
  }

  @Post(':id/submit')
  submitForProcessing(@Param('id') id: string) {
    return this.superbillsService.submitForProcessing(id);
  }

  @Post(':id/calculate')
  calculateTotals(@Param('id') id: string) {
    return this.superbillsService.calculateTotals(id);
  }
}
