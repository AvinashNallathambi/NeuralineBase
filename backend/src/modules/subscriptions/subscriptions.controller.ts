import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  Param,
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

  // ── Payment Method Management (Phase 1, 3) ────────────────────────

  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all saved payment methods for the tenant' })
  getPaymentMethods(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getPaymentMethods(tenantId);
  }

  @Post('setup-intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a SetupIntent for collecting new payment method details' })
  createSetupIntent(
    @Req() req: AuthenticatedRequest,
    @Body() body: { paymentMethodTypes?: string[] },
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.createSetupIntent(tenantId, body.paymentMethodTypes);
  }

  @Post('payment-methods/attach')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Attach a new payment method to the tenant' })
  attachPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Body() body: { stripePaymentMethodId: string; setAsDefault?: boolean },
  ) {
    if (!body.stripePaymentMethodId) {
      throw new BadRequestException('stripePaymentMethodId is required');
    }
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.attachPaymentMethod(
      tenantId,
      body.stripePaymentMethodId,
      body.setAsDefault,
    );
  }

  @Delete('payment-methods/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Detach (remove) a payment method' })
  async detachPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.detachPaymentMethod(tenantId, id);
  }

  @Patch('payment-methods/:id/default')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Set a payment method as the default' })
  setDefaultPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.setDefaultPaymentMethod(tenantId, id);
  }

  // ── Card Expiry Check (Phase 2) ───────────────────────────────────

  @Get('payment-methods/expiry-check')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check for expiring or expired cards' })
  checkCardExpiry(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.checkCardExpiry(tenantId);
  }

  // ── Retry Failed Payment (Phase 2) ────────────────────────────────

  @Post('retry-payment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retry a failed invoice payment' })
  retryFailedPayment(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.retryFailedPayment(tenantId);
  }

  // ── Customer Portal (Phase 4) ─────────────────────────────────────

  @Post('customer-portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session for self-service billing' })
  createCustomerPortalSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: { returnUrl?: string },
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    const returnUrl = body.returnUrl ?? '/settings?tab=billing';
    return this.subscriptionsService.createCustomerPortalSession(tenantId, returnUrl);
  }

  // ── Transaction Fee Transparency (Phase 4) ────────────────────────

  @Get('fee-estimate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get processing fee estimates for different payment methods' })
  getFeeEstimate(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getFeeEstimate(tenantId);
  }

  // ── AI-Driven Payment Optimization (Phase 4) ──────────────────────

  @Get('payment-optimization')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get AI-driven payment optimization suggestions' })
  getPaymentOptimization(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getPaymentOptimizationSuggestions(tenantId);
  }

  // ── Payment Plans / Scheduled Payments (Phase 4) ──────────────────

  @Get('payment-plans')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all payment plans for the tenant' })
  getPaymentPlans(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.getPaymentPlans(tenantId);
  }

  @Post('payment-plans')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new payment plan' })
  createPaymentPlan(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      description: string;
      totalAmount: number;
      installmentAmount: number;
      frequency?: string;
      stripePaymentMethodId?: string;
    },
  ) {
    if (!body.description || !body.totalAmount || !body.installmentAmount) {
      throw new BadRequestException('description, totalAmount, and installmentAmount are required');
    }
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.createPaymentPlan({
      tenantId,
      description: body.description,
      totalAmount: body.totalAmount,
      installmentAmount: body.installmentAmount,
      frequency: body.frequency as any,
      stripePaymentMethodId: body.stripePaymentMethodId,
    });
  }

  @Post('payment-plans/:id/installment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Record a payment against a payment plan installment' })
  recordInstallment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    if (!body.amount) throw new BadRequestException('amount is required');
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.recordPaymentPlanInstallment(tenantId, id, body.amount);
  }

  @Post('payment-plans/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a payment plan' })
  cancelPaymentPlan(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.subscriptionsService.cancelPaymentPlan(tenantId, id);
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
