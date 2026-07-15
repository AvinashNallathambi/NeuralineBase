import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingCycle } from './entities/subscription.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ── Plans ─────────────────────────────────────────────────────────

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all available subscription plans' })
  getPlans() {
    return this.subscriptionsService.getAllPlans();
  }

  // ── Create subscription (called after registration) ───────────────

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new subscription for the tenant (post-registration)' })
  createSubscription(
    @Req() req: AuthenticatedRequest,
    @Body() body: { planTier: string; billingCycle?: BillingCycle; tenantName?: string; tenantEmail?: string },
  ) {
    if (!body.planTier) {
      throw new BadRequestException('planTier is required');
    }
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.createSubscription({
      tenantId,
      tenantName: body.tenantName ?? 'New Tenant',
      tenantEmail: body.tenantEmail ?? req.user?.email ?? '',
      planTier: body.planTier,
      billingCycle: body.billingCycle,
    });
  }

  // ── Current subscription ──────────────────────────────────────────

  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the current subscription for the tenant' })
  getCurrent(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getSubscriptionWithPlan(tenantId);
  }

  // ── Change plan ───────────────────────────────────────────────────

  @Patch('change-plan')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upgrade or downgrade the subscription plan' })
  changePlan(
    @Req() req: AuthenticatedRequest,
    @Body() body: { planTier: string; billingCycle?: BillingCycle },
  ) {
    if (!body.planTier) {
      throw new BadRequestException('planTier is required');
    }
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.changePlan(
      tenantId,
      body.planTier,
      body.billingCycle,
    );
  }

  // ── Cancel ────────────────────────────────────────────────────────

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel the subscription (immediately or at period end)' })
  cancel(
    @Req() req: AuthenticatedRequest,
    @Body() body: { cancelAtPeriodEnd?: boolean },
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.cancelSubscription(
      tenantId,
      body.cancelAtPeriodEnd ?? false,
    );
  }

  // ── Reactivate ────────────────────────────────────────────────────

  @Post('reactivate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reactivate a cancelled subscription' })
  reactivate(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.reactivateSubscription(tenantId);
  }

  // ── Invoice history ───────────────────────────────────────────────

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List subscription billing history (invoices)' })
  getInvoices(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getInvoices(tenantId);
  }

  // ── Feature check ─────────────────────────────────────────────────

  @Get('features/:feature')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if the current plan includes a feature' })
  async checkFeature(@Req() req: AuthenticatedRequest, feature: string) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    const hasFeature = await this.subscriptionsService.hasFeature(tenantId, feature);
    return { feature, hasFeature };
  }

  // ── Webhook (NOT guarded by JWT) ──────────────────────────────────

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
    return this.subscriptionsService.handleWebhook(raw, signature ?? '');
  }
}
