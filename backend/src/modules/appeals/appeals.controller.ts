import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AppealsService } from './appeals.service';
import { AppealStatus, AppealOutcome } from './entities/appeal.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('appeals')
@UseGuards(JwtAuthGuard)
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Post('from-denial/:denialId')
  createFromDenial(@Param('denialId') denialId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.appealsService.createFromDenial(denialId, tenantId);
  }

  @Post(':id/generate-letter')
  generateLetter(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.appealsService.generateAppealLetter(id, tenantId);
  }

  @Post(':id/predict-success')
  predictSuccess(@Param('id') id: string) {
    return this.appealsService.predictSuccess(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id || null;
    const userName = req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'User';
    return this.appealsService.submit(id, userId, userName);
  }

  @Get()
  findAll(@Query('status') status?: AppealStatus, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.appealsService.findAll(tenantId, status);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.appealsService.getStats(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appealsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: {
      status: AppealStatus;
      outcome?: AppealOutcome;
      recoveredAmount?: number;
      notes?: string;
    },
    @Request() req: any,
  ) {
    const userId = req.user?.id || null;
    const userName = req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'User';
    return this.appealsService.updateStatus(
      id,
      body.status,
      body.outcome,
      body.recoveredAmount,
      body.notes,
      userId,
      userName,
    );
  }
}
