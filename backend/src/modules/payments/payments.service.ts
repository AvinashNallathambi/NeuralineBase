import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import {
  PaymentsProvider,
  PAYMENTS_PROVIDER,
} from './providers/payments-provider.interface';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(PAYMENTS_PROVIDER)
    private paymentsProvider: PaymentsProvider,
    private billingService: BillingService,
  ) {}

  /**
   * Create a Payment record and a provider PaymentIntent.
   * Returns the client secret for browser-side confirmation (Stripe.js).
   */
  async createPaymentIntent(params: {
    tenantId: string;
    invoiceId: string;
    patientId: string;
    patientName: string;
    amount: number;
    method?: PaymentMethod;
    description?: string;
  }): Promise<{
    paymentId: string;
    providerPaymentId: string;
    clientSecret: string | null;
    status: PaymentStatus;
  }> {
    // Validate the invoice belongs to the patient and the amount is sane
    const invoice = await this.billingService.findOneInvoice(params.invoiceId);
    if (invoice.patientId !== params.patientId) {
      throw new BadRequestException('Invoice does not belong to this patient');
    }
    if (params.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (params.amount > Number(invoice.balanceDue)) {
      throw new BadRequestException(
        `Payment amount ($${params.amount}) exceeds invoice balance due ($${invoice.balanceDue})`,
      );
    }

    const payment = this.paymentRepository.create({
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      patientId: params.patientId,
      patientName: params.patientName,
      amount: params.amount,
      status: PaymentStatus.PENDING,
      method: params.method ?? PaymentMethod.CARD,
      provider: this.paymentsProvider.name,
      currency: 'usd',
      description: params.description ?? `Invoice ${invoice.invoiceNumber}`,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
    const saved = await this.paymentRepository.save(payment);

    const intent = await this.paymentsProvider.createPaymentIntent({
      paymentId: saved.id,
      amount: params.amount,
      currency: 'usd',
      description: payment.description ?? undefined,
      patientId: params.patientId,
      patientName: params.patientName,
      invoiceId: params.invoiceId,
    });

    saved.providerPaymentId = intent.providerPaymentId;
    saved.clientSecret = intent.clientSecret;
    await this.paymentRepository.save(saved);

    return {
      paymentId: saved.id,
      providerPaymentId: intent.providerPaymentId,
      clientSecret: intent.clientSecret,
      status: PaymentStatus.PENDING,
    };
  }

  /**
   * Confirm a payment that was authorized on the client (Stripe.js) or
   * server-side. On success, posts the payment to the linked invoice via
   * BillingService.recordPayment.
   */
  async confirmPayment(params: {
    paymentId: string;
    paymentMethodId?: string;
  }): Promise<{ status: PaymentStatus; invoiceStatus?: string }> {
    const payment = await this.findOnePayment(params.paymentId);

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return { status: PaymentStatus.SUCCEEDED };
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException('Payment has no provider payment id');
    }

    const result = await this.paymentsProvider.confirmPayment({
      providerPaymentId: payment.providerPaymentId,
      paymentMethodId: params.paymentMethodId,
    });

    if (result.succeeded) {
      payment.status = PaymentStatus.SUCCEEDED;
      await this.paymentRepository.save(payment);

      // Post to the invoice
      const invoice = await this.billingService.recordPayment(
        payment.invoiceId!,
        Number(payment.amount),
        payment.method,
        payment.providerPaymentId,
      );

      this.logger.log(
        `Payment ${payment.id} succeeded → invoice ${invoice.invoiceNumber} (${invoice.status})`,
      );
      return { status: PaymentStatus.SUCCEEDED, invoiceStatus: invoice.status };
    }

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = result.failureReason ?? null;
    await this.paymentRepository.save(payment);
    this.logger.warn(`Payment ${payment.id} failed: ${result.failureReason}`);
    return { status: PaymentStatus.FAILED };
  }

  /**
   * Handle an inbound webhook from the payment provider.
   * Body is the raw payload; signature is the provider-specific header.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<{ processed: boolean }> {
    const event = this.paymentsProvider.parseWebhook(rawBody, signature);
    this.logger.log(`Webhook: ${event.providerPaymentId} → ${event.status}`);

    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: event.providerPaymentId },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${event.providerPaymentId}`);
      return { processed: false };
    }

    if (event.status === 'succeeded' && payment.status !== PaymentStatus.SUCCEEDED) {
      payment.status = PaymentStatus.SUCCEEDED;
      await this.paymentRepository.save(payment);
      if (payment.invoiceId) {
        await this.billingService.recordPayment(
          payment.invoiceId,
          Number(payment.amount),
          payment.method,
          payment.providerPaymentId ?? undefined,
        );
      }
    } else if (event.status === 'failed') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepository.save(payment);
    } else if (event.status === 'refunded') {
      payment.status = PaymentStatus.REFUNDED;
      await this.paymentRepository.save(payment);
    }

    return { processed: true };
  }

  async findOnePayment(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment with ID ${id} not found`);
    return payment;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
