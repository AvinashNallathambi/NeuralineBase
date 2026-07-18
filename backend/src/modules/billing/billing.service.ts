import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncounterClaim, ClaimStatus } from './entities/encounter-claim.entity';
import { ClaimLineItem } from './entities/claim-line-item.entity';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { InsurancePayer } from './entities/insurance-payer.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { CreateEncounterClaimDto, CreateClaimLineItemDto } from './dto/create-encounter-claim.dto';
import { UpdateEncounterClaimDto } from './dto/update-encounter-claim.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(EncounterClaim)
    private claimRepository: Repository<EncounterClaim>,
    @InjectRepository(ClaimLineItem)
    private lineItemRepository: Repository<ClaimLineItem>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InsurancePayer)
    private payerRepository: Repository<InsurancePayer>,
    @InjectRepository(PatientInsurance)
    private patientInsuranceRepository: Repository<PatientInsurance>,
  ) {}

  // ─── Encounter Claims ─────────────────────────────────────────────

  async createClaim(createClaimDto: CreateEncounterClaimDto): Promise<EncounterClaim> {
    const claimNumber = this.generateClaimNumber();
    
    const claim = this.claimRepository.create({
      ...createClaimDto,
      claimNumber,
      status: createClaimDto.status || ClaimStatus.DRAFT,
      totalBilled: 0,
      totalPaid: 0,
      patientResponsibility: 0,
      deductibleApplied: 0,
      copayApplied: 0,
      coinsuranceApplied: 0,
      adjustmentAmount: 0,
    });

    const savedClaim = await this.claimRepository.save(claim);

    // Save line items
    if (createClaimDto.lineItems && createClaimDto.lineItems.length > 0) {
      const lineItems = createClaimDto.lineItems.map((item) =>
        this.lineItemRepository.create({
          ...item,
          claimId: savedClaim.id,
          totalCharge: item.quantity * item.unitPrice,
          paidAmount: 0,
          patientResponsibility: 0,
          deductibleAmount: 0,
          copayAmount: 0,
          coinsuranceAmount: 0,
          adjustmentAmount: 0,
        }),
      );
      await this.lineItemRepository.save(lineItems);
      
      // Calculate total billed
      const totalBilled = lineItems.reduce((sum, item) => sum + item.totalCharge, 0);
      savedClaim.totalBilled = totalBilled;
      await this.claimRepository.save(savedClaim);
    }

    return this.findOneClaim(savedClaim.id);
  }

  async findAllClaims(params?: {
    patientId?: string;
    providerId?: string;
    status?: ClaimStatus;
  }): Promise<EncounterClaim[]> {
    const where: any = {};
    if (params?.patientId) where.patientId = params.patientId;
    if (params?.providerId) where.providerId = params.providerId;
    if (params?.status) where.status = params.status;

    return this.claimRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneClaim(id: string): Promise<EncounterClaim> {
    const claim = await this.claimRepository.findOne({
      where: { id },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    return claim;
  }

  async updateClaim(id: string, updateClaimDto: UpdateEncounterClaimDto): Promise<EncounterClaim> {
    const claim = await this.findOneClaim(id);

    // Prevent modification of submitted claims
    if (
      claim.status === ClaimStatus.SUBMITTED ||
      claim.status === ClaimStatus.PAID ||
      claim.status === ClaimStatus.DENIED
    ) {
      throw new BadRequestException(
        'Cannot modify claim that has been submitted, paid, or denied',
      );
    }

    Object.assign(claim, updateClaimDto);

    if (updateClaimDto.serviceDate) {
      claim.serviceDate = new Date(updateClaimDto.serviceDate);
    }

    const savedClaim = await this.claimRepository.save(claim);

    // Update line items if provided
    if (updateClaimDto.lineItems) {
      await this.lineItemRepository.delete({ claimId: id });

      const lineItems = updateClaimDto.lineItems.map((item) =>
        this.lineItemRepository.create({
          ...item,
          claimId: savedClaim.id,
          totalCharge: item.quantity * item.unitPrice,
          paidAmount: 0,
          patientResponsibility: 0,
          deductibleAmount: 0,
          copayAmount: 0,
          coinsuranceAmount: 0,
          adjustmentAmount: 0,
        }),
      );
      await this.lineItemRepository.save(lineItems);
      
      // Recalculate total billed
      const totalBilled = lineItems.reduce((sum, item) => sum + item.totalCharge, 0);
      savedClaim.totalBilled = totalBilled;
      await this.claimRepository.save(savedClaim);
    }

    return this.findOneClaim(savedClaim.id);
  }

  async deleteClaim(id: string): Promise<void> {
    const claim = await this.findOneClaim(id);

    // Prevent deletion of submitted claims
    if (
      claim.status === ClaimStatus.SUBMITTED ||
      claim.status === ClaimStatus.PAID ||
      claim.status === ClaimStatus.DENIED
    ) {
      throw new BadRequestException(
        'Cannot delete claim that has been submitted, paid, or denied',
      );
    }

    await this.claimRepository.remove(claim);
  }

  async updateClaimStatus(id: string, status: ClaimStatus): Promise<EncounterClaim> {
    const claim = await this.findOneClaim(id);

    // Validate status transitions
    if (claim.status === ClaimStatus.DRAFT && status !== ClaimStatus.READY_TO_BILL) {
      throw new BadRequestException('Draft claims can only be moved to Ready to Bill');
    }

    if (claim.status === ClaimStatus.READY_TO_BILL && status !== ClaimStatus.SUBMITTED) {
      throw new BadRequestException('Ready to Bill claims can only be moved to Submitted');
    }

    claim.status = status;

    if (status === ClaimStatus.SUBMITTED) {
      claim.submissionDate = new Date();
    }

    return this.claimRepository.save(claim);
  }

  async calculateClaimTotals(id: string): Promise<{
    totalBilled: number;
    totalAllowed: number;
    totalPaid: number;
    patientResponsibility: number;
    deductibleApplied: number;
    copayApplied: number;
    coinsuranceApplied: number;
    adjustmentAmount: number;
  }> {
    const claim = await this.findOneClaim(id);

    let totalBilled = 0;
    let totalAllowed = 0;
    let totalPaid = 0;
    let patientResponsibility = 0;
    let deductibleApplied = 0;
    let copayApplied = 0;
    let coinsuranceApplied = 0;
    let adjustmentAmount = 0;

    // Sum line items
    (claim.lineItems as any[]).forEach((item) => {
      totalBilled += item.totalCharge;
      totalAllowed += item.allowedAmount || 0;
      totalPaid += item.paidAmount;
      patientResponsibility += item.patientResponsibility;
      deductibleApplied += item.deductibleAmount;
      copayApplied += item.copayAmount;
      coinsuranceApplied += item.coinsuranceAmount;
      adjustmentAmount += item.adjustmentAmount;
    });

    // Update claim
    claim.totalBilled = totalBilled;
    claim.totalAllowed = totalAllowed || null;
    claim.totalPaid = totalPaid;
    claim.patientResponsibility = patientResponsibility;
    claim.deductibleApplied = deductibleApplied;
    claim.copayApplied = copayApplied;
    claim.coinsuranceApplied = coinsuranceApplied;
    claim.adjustmentAmount = adjustmentAmount;

    await this.claimRepository.save(claim);

    return {
      totalBilled,
      totalAllowed,
      totalPaid,
      patientResponsibility,
      deductibleApplied,
      copayApplied,
      coinsuranceApplied,
      adjustmentAmount,
    };
  }

  // ─── Invoices ───────────────────────────────────────────────────────

  async createInvoice(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const invoiceNumber = this.generateInvoiceNumber();
    
    const invoice = this.invoiceRepository.create({
      ...createInvoiceDto,
      invoiceNumber,
      status: createInvoiceDto.status || InvoiceStatus.DRAFT,
      subtotal: createInvoiceDto.subtotal || 0,
      taxAmount: createInvoiceDto.taxAmount || 0,
      discountAmount: createInvoiceDto.discountAmount || 0,
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Save line items
    if (createInvoiceDto.lineItems && createInvoiceDto.lineItems.length > 0) {
      const lineItems = createInvoiceDto.lineItems.map((item) =>
        this.lineItemRepository.create({
          ...item,
          claimId: savedInvoice.id,
          totalCharge: item.quantity * item.unitPrice,
          paidAmount: 0,
          patientResponsibility: 0,
          deductibleAmount: 0,
          copayAmount: 0,
          coinsuranceAmount: 0,
          adjustmentAmount: 0,
        }),
      );
      await this.lineItemRepository.save(lineItems);
      
      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.totalCharge, 0);
      const totalAmount = subtotal + (invoice.taxAmount || 0) - (invoice.discountAmount || 0);
      savedInvoice.subtotal = subtotal;
      savedInvoice.totalAmount = totalAmount;
      savedInvoice.balanceDue = totalAmount;
      await this.invoiceRepository.save(savedInvoice);
    }

    return this.findOneInvoice(savedInvoice.id);
  }

  async findAllInvoices(params?: {
    patientId?: string;
    providerId?: string;
    status?: InvoiceStatus;
  }): Promise<Invoice[]> {
    const where: any = {};
    if (params?.patientId) where.patientId = params.patientId;
    if (params?.providerId) where.providerId = params.providerId;
    if (params?.status) where.status = params.status;

    return this.invoiceRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneInvoice(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async updateInvoice(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOneInvoice(id);

    // Prevent modification of sent invoices
    if (
      invoice.status === InvoiceStatus.SENT ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException(
        'Cannot modify invoice that has been sent or paid',
      );
    }

    Object.assign(invoice, updateInvoiceDto);

    if (updateInvoiceDto.serviceDate) {
      invoice.serviceDate = new Date(updateInvoiceDto.serviceDate);
    }
    if (updateInvoiceDto.invoiceDate) {
      invoice.invoiceDate = new Date(updateInvoiceDto.invoiceDate);
    }
    if (updateInvoiceDto.dueDate) {
      invoice.dueDate = new Date(updateInvoiceDto.dueDate);
    }

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Update line items if provided
    if (updateInvoiceDto.lineItems) {
      await this.lineItemRepository.delete({ claimId: id });

      const lineItems = updateInvoiceDto.lineItems.map((item) =>
        this.lineItemRepository.create({
          ...item,
          claimId: savedInvoice.id,
          totalCharge: item.quantity * item.unitPrice,
          paidAmount: 0,
          patientResponsibility: 0,
          deductibleAmount: 0,
          copayAmount: 0,
          coinsuranceAmount: 0,
          adjustmentAmount: 0,
        }),
      );
      await this.lineItemRepository.save(lineItems);
      
      // Recalculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.totalCharge, 0);
      const totalAmount = subtotal + (savedInvoice.taxAmount || 0) - (savedInvoice.discountAmount || 0);
      savedInvoice.subtotal = subtotal;
      savedInvoice.totalAmount = totalAmount;
      savedInvoice.balanceDue = totalAmount - savedInvoice.amountPaid;
      await this.invoiceRepository.save(savedInvoice);
    }

    return this.findOneInvoice(savedInvoice.id);
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoice = await this.findOneInvoice(id);

    // Prevent deletion of sent invoices
    if (
      invoice.status === InvoiceStatus.SENT ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException(
        'Cannot delete invoice that has been sent or paid',
      );
    }

    await this.invoiceRepository.remove(invoice);
  }

  async updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOneInvoice(id);
    invoice.status = status;
    return this.invoiceRepository.save(invoice);
  }

  async recordPayment(id: string, amount: number, paymentMethod: string, reference?: string): Promise<Invoice> {
    const invoice = await this.findOneInvoice(id);

    if (amount > invoice.balanceDue) {
      throw new BadRequestException('Payment amount exceeds balance due');
    }

    invoice.amountPaid += amount;
    invoice.balanceDue -= amount;
    invoice.paymentMethod = paymentMethod;
    if (reference) invoice.paymentReference = reference;

    if (invoice.balanceDue === 0) {
      invoice.status = InvoiceStatus.PAID;
    } else if (invoice.amountPaid > 0) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }

    return this.invoiceRepository.save(invoice);
  }

  // ─── Insurance Payers ───────────────────────────────────────────────

  async findAllPayers(): Promise<InsurancePayer[]> {
    return this.payerRepository.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async findOnePayer(id: string): Promise<InsurancePayer> {
    const payer = await this.payerRepository.findOne({
      where: { id },
    });

    if (!payer) {
      throw new NotFoundException(`Insurance payer with ID ${id} not found`);
    }

    return payer;
  }

  // ─── Patient Insurance ──────────────────────────────────────────────

  async findPatientInsurances(patientId: string): Promise<PatientInsurance[]> {
    return this.patientInsuranceRepository.find({
      where: { patientId, status: 'active' },
      relations: ['payer'],
      order: { priority: 'ASC' },
    });
  }

  // ─── Utilities ──────────────────────────────────────────────────────

  private generateClaimNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CLM-${timestamp}-${random}`;
  }

  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }
}
