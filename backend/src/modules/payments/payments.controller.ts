import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PaymentMethod } from './entities/payment.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a payment intent for an invoice' })
  createIntent(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      invoiceId: string;
      patientId: string;
      patientName: string;
      amount: number;
      method?: PaymentMethod;
      description?: string;
    },
  ) {
    return this.paymentsService.createPaymentIntent({
      tenantId: req.tenantId ?? req.user?.tenantId,
      ...body,
    });
  }

  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Confirm a pending payment' })
  confirmPayment(
    @Body() body: { paymentId: string; paymentMethodId?: string },
  ) {
    return this.paymentsService.confirmPayment(body);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a payment by id' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOnePayment(id);
  }

  @Get('invoice/:invoiceId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List payments for an invoice' })
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.paymentsService.findByInvoice(invoiceId);
  }

  @Get('patient/:patientId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List payments for a patient' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.paymentsService.findByPatient(patientId);
  }

  // Webhook endpoint is NOT guarded by JWT — providers post raw payloads.
  @Post('webhook')
  webhook(
    @Req() req: { rawBody?: Buffer; body?: unknown },
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? req.rawBody.toString('utf8')
          : JSON.stringify(req.body ?? {});
    return this.paymentsService.handleWebhook(raw, signature ?? '');
  }
}
