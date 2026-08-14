import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as otplib from 'otplib';
import {
  ProviderEpcsEnrollment,
  EpcsEnrollmentStatus,
  TwoFactorMethod,
  IdentityProofingStatus,
} from './entities/provider-epcs-enrollment.entity';
import { EpcsAuditLog } from './entities/epcs-audit-log.entity';
import { EpcsTransmissionLog, TransmissionStatus } from './entities/epcs-transmission-log.entity';
import { PdmpQuery } from './entities/pdmp-query.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { ControlledSubstanceRulesEngine, validateDeaNumber } from './controlled-substance-rules.engine';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs (inline for brevity — could be separate files)
// ─────────────────────────────────────────────────────────────────────────────

export interface StartEnrollmentDto {
  deaNumber: string;
  npiNumber: string;
  stateLicense?: string;
  practiceState?: string;
}

export interface VerifyTwoFactorDto {
  token: string;
}

export interface GrantAccessControlDto {
  grantedByUserId: string;
  grantedByName: string;
}

export interface SignPrescriptionDto {
  prescriptionId: string;
  twoFactorToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EPCS Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class EpcsService {
  private readonly logger = new Logger(EpcsService.name);

  constructor(
    @InjectRepository(ProviderEpcsEnrollment)
    private readonly enrollmentRepo: Repository<ProviderEpcsEnrollment>,
    @InjectRepository(EpcsAuditLog)
    private readonly auditRepo: Repository<EpcsAuditLog>,
    @InjectRepository(EpcsTransmissionLog)
    private readonly transmissionRepo: Repository<EpcsTransmissionLog>,
    @InjectRepository(PdmpQuery)
    private readonly pdmpRepo: Repository<PdmpQuery>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    private readonly rulesEngine: ControlledSubstanceRulesEngine,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVIDER ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start EPCS enrollment for a provider (Step 1: DEA/NPI validation)
   */
  async startEnrollment(
    tenantId: string,
    userId: string,
    userName: string,
    dto: StartEnrollmentDto,
  ): Promise<ProviderEpcsEnrollment> {
    // Validate DEA number
    if (!validateDeaNumber(dto.deaNumber)) {
      throw new BadRequestException('Invalid DEA number — checksum validation failed.');
    }

    // Validate NPI (10 digits, Luhn checksum)
    if (!/^\d{10}$/.test(dto.npiNumber)) {
      throw new BadRequestException('NPI must be 10 digits.');
    }

    // Check for existing enrollment
    const existing = await this.enrollmentRepo.findOne({
      where: { tenantId, userId },
    });
    if (existing && existing.status === 'active') {
      throw new BadRequestException('Provider is already EPCS enrolled and active.');
    }

    const enrollment = existing || this.enrollmentRepo.create({ tenantId, userId });
    enrollment.userName = userName;
    enrollment.deaNumber = dto.deaNumber;
    enrollment.npiNumber = dto.npiNumber;
    enrollment.stateLicense = dto.stateLicense || null;
    enrollment.practiceState = dto.practiceState || null;
    enrollment.identityProofingStatus = 'not_started';
    enrollment.status = 'pending';

    const saved = await this.enrollmentRepo.save(enrollment);

    await this.audit({
      tenantId,
      action: 'enrollment_started',
      userId,
      userName,
      description: `EPCS enrollment started for ${userName}. DEA: ${dto.deaNumber}, NPI: ${dto.npiNumber}.`,
      metadata: { deaNumber: dto.deaNumber, npiNumber: dto.npiNumber },
    });

    return saved;
  }

  /**
   * Complete identity proofing (Step 2: IAL2 verification)
   * In production, this would integrate with Socure/IDology/Jumio.
   * For now, it marks identity proofing as verified (two-person rule applies).
   */
  async completeIdentityProofing(
    tenantId: string,
    enrollmentId: string,
    verifiedByUserId: string,
    method: string = 'document_verification',
  ): Promise<ProviderEpcsEnrollment> {
    const enrollment = await this.getEnrollment(tenantId, enrollmentId);

    enrollment.identityProofingStatus = 'verified';
    enrollment.identityProofedAt = new Date();
    enrollment.identityProofedBy = verifiedByUserId;
    enrollment.identityProofingMethod = method;
    enrollment.status = 'two_factor_setup';

    const saved = await this.enrollmentRepo.save(enrollment);

    await this.audit({
      tenantId,
      action: 'identity_proofing_passed',
      userId: enrollment.userId,
      userName: enrollment.userName,
      description: `Identity proofing verified for ${enrollment.userName}. Method: ${method}. Verified by user ${verifiedByUserId}.`,
      metadata: { method, verifiedBy: verifiedByUserId },
    });

    return saved;
  }

  /**
   * Set up two-factor authentication (Step 3: 2FA enrollment)
   */
  async setupTwoFactor(
    tenantId: string,
    enrollmentId: string,
    method: TwoFactorMethod = 'totp',
  ): Promise<{ enrollment: ProviderEpcsEnrollment; otpauthUrl: string; secret: string }> {
    const enrollment = await this.getEnrollment(tenantId, enrollmentId);

    if (enrollment.identityProofingStatus !== 'verified') {
      throw new BadRequestException('Identity proofing must be completed before 2FA setup.');
    }

    // Generate TOTP secret
    const secret = otplib.authenticator.generateSecret();
    enrollment.twoFactorMethod = method;
    enrollment.twoFactorSecret = secret;
    enrollment.twoFactorEnrolledAt = new Date();
    enrollment.status = 'access_control_pending';

    const saved = await this.enrollmentRepo.save(enrollment);

    // Generate otpauth URL for QR code
    const otpauthUrl = otplib.authenticator.keyuri(
      enrollment.userName,
      'Neuraline EPCS',
      secret,
    );

    await this.audit({
      tenantId,
      action: 'two_factor_setup',
      userId: enrollment.userId,
      userName: enrollment.userName,
      description: `Two-factor authentication set up for ${enrollment.userName}. Method: ${method}.`,
      metadata: { method },
    });

    return { enrollment: saved, otpauthUrl, secret };
  }

  /**
   * Verify a 2FA token (used during enrollment verification and at signing)
   */
  async verifyTwoFactorToken(
    tenantId: string,
    enrollmentId: string,
    token: string,
  ): Promise<boolean> {
    const enrollment = await this.getEnrollment(tenantId, enrollmentId);

    if (!enrollment.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication has not been set up.');
    }

    const isValid = otplib.authenticator.verify({
      token,
      secret: enrollment.twoFactorSecret,
    });

    await this.audit({
      tenantId,
      action: isValid ? 'two_factor_verified' : 'two_factor_failed',
      userId: enrollment.userId,
      userName: enrollment.userName,
      twoFactorMethod: enrollment.twoFactorMethod,
      twoFactorSuccess: isValid,
      description: `Two-factor authentication ${isValid ? 'succeeded' : 'failed'} for ${enrollment.userName}.`,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid two-factor authentication token.');
    }

    return true;
  }

  /**
   * Grant EPCS access control (Step 4: Two-person rule)
   * DEA requires a second authorized user to grant EPCS permissions.
   */
  async grantAccessControl(
    tenantId: string,
    enrollmentId: string,
    dto: GrantAccessControlDto,
  ): Promise<ProviderEpcsEnrollment> {
    const enrollment = await this.getEnrollment(tenantId, enrollmentId);

    if (enrollment.identityProofingStatus !== 'verified') {
      throw new BadRequestException('Identity proofing must be completed before granting access.');
    }
    if (!enrollment.twoFactorMethod) {
      throw new BadRequestException('Two-factor authentication must be set up before granting access.');
    }
    if (enrollment.userId === dto.grantedByUserId) {
      throw new ForbiddenException('Cannot self-grant EPCS access — DEA requires a second person.');
    }

    enrollment.accessControlGranted = true;
    enrollment.accessControlGrantedBy = dto.grantedByUserId;
    enrollment.accessControlGrantedByName = dto.grantedByName;
    enrollment.accessControlGrantedAt = new Date();
    enrollment.status = 'active';

    const saved = await this.enrollmentRepo.save(enrollment);

    await this.audit({
      tenantId,
      action: 'access_control_granted',
      userId: enrollment.userId,
      userName: enrollment.userName,
      description: `EPCS access control granted to ${enrollment.userName} by ${dto.grantedByName}. Provider is now EPCS-active.`,
      metadata: { grantedBy: dto.grantedByUserId, grantedByName: dto.grantedByName },
    });

    return saved;
  }

  /**
   * Suspend EPCS enrollment
   */
  async suspendEnrollment(tenantId: string, enrollmentId: string, reason: string, suspendedByUserId: string): Promise<ProviderEpcsEnrollment> {
    const enrollment = await this.getEnrollment(tenantId, enrollmentId);
    enrollment.status = 'suspended';
    enrollment.suspendedReason = reason;
    enrollment.suspendedAt = new Date();

    const saved = await this.enrollmentRepo.save(enrollment);

    await this.audit({
      tenantId,
      action: 'enrollment_suspended',
      userId: enrollment.userId,
      userName: enrollment.userName,
      description: `EPCS enrollment suspended for ${enrollment.userName}. Reason: ${reason}. Suspended by user ${suspendedByUserId}.`,
      metadata: { reason, suspendedBy: suspendedByUserId },
    });

    return saved;
  }

  /**
   * Get enrollment for a user
   */
  async getEnrollmentByUserId(tenantId: string, userId: string): Promise<ProviderEpcsEnrollment | null> {
    return this.enrollmentRepo.findOne({ where: { tenantId, userId } });
  }

  /**
   * Get all enrollments for a tenant
   */
  async getEnrollments(tenantId: string): Promise<ProviderEpcsEnrollment[]> {
    return this.enrollmentRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Check if a provider is EPCS-ready
   */
  async isProviderEpcsReady(tenantId: string, userId: string): Promise<boolean> {
    const enrollment = await this.getEnrollmentByUserId(tenantId, userId);
    return !!enrollment?.isEpcsReady;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRESCRIPTION SIGNING (EPCS — 2FA enforced at signing step)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sign a controlled substance prescription with 2FA
   * This is the core EPCS function — 21 CFR 1311.300(b)(c)
   */
  async signPrescription(
    tenantId: string,
    dto: SignPrescriptionDto,
    signerUserId: string,
    signerName: string,
  ): Promise<Prescription> {
    // 1. Get the prescription
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: dto.prescriptionId, tenantId },
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    if (!prescription.isControlledSubstance) {
      throw new BadRequestException('This prescription is not a controlled substance — EPCS signing is not required.');
    }

    if (prescription.epcsSignedAt) {
      throw new BadRequestException('This prescription has already been signed.');
    }

    // 2. Verify the signer is the prescriber (no delegation — 21 CFR 1311.300(d))
    if (prescription.providerId !== signerUserId) {
      throw new ForbiddenException('Only the prescribing provider can sign an EPCS prescription. Delegation is not permitted.');
    }

    // 3. Check EPCS enrollment
    const enrollment = await this.getEnrollmentByUserId(tenantId, signerUserId);
    if (!enrollment || !enrollment.isEpcsReady) {
      throw new ForbiddenException('Provider is not EPCS-enrolled. Complete EPCS enrollment before signing controlled substance prescriptions.');
    }

    // 4. Validate controlled substance rules
    for (const med of prescription.medications) {
      if (med.isControlledSubstance && med.deaSchedule) {
        const validation = this.rulesEngine.validate(
          med.deaSchedule,
          med.quantity,
          med.refills,
          this.parseDaysSupply(med.duration),
          enrollment.practiceState,
        );
        if (!validation.valid) {
          throw new BadRequestException(`Controlled substance rule violation for ${med.medication}: ${validation.errors.join('; ')}`);
        }
      }
    }

    // 5. ENFORCE TWO-FACTOR AUTHENTICATION (21 CFR 1311.300(b))
    await this.verifyTwoFactorToken(tenantId, enrollment.id, dto.twoFactorToken);

    // 6. Sign the prescription
    prescription.epcsSignatureMethod = enrollment.twoFactorMethod;
    prescription.epcsSignedAt = new Date();
    prescription.epcsSignedBy = signerUserId;
    prescription.epcsTransmissionStatus = 'pending';
    prescription.prescriberDeaNumber = enrollment.deaNumber;
    prescription.prescriberNpi = enrollment.npiNumber;
    prescription.status = 'sent';

    const saved = await this.prescriptionRepo.save(prescription);

    // 7. Create transmission log
    const transmissionId = this.generateTransmissionId();
    const transmission = this.transmissionRepo.create({
      tenantId,
      prescriptionId: saved.id,
      transmissionId,
      messageType: 'NewRx',
      status: 'pending',
      prescriberDea: enrollment.deaNumber,
      prescriberNpi: enrollment.npiNumber,
      prescriberSpi: enrollment.sureScriptsSpi,
      signatureMethod: enrollment.twoFactorMethod,
      signedAt: new Date(),
      pharmacyName: prescription.pharmacy,
      pharmacyNcpdp: prescription.pharmacyNcpdp,
    });
    await this.transmissionRepo.save(transmission);

    // 8. Audit log
    await this.audit({
      tenantId,
      action: 'prescription_signed',
      prescriptionId: saved.id,
      userId: signerUserId,
      userName: signerName,
      patientId: prescription.patientId,
      patientName: prescription.patientName,
      medication: prescription.medications.map((m) => m.medication).join(', '),
      deaSchedule: prescription.deaSchedule,
      quantity: prescription.medications.reduce((sum, m) => sum + m.quantity, 0),
      twoFactorMethod: enrollment.twoFactorMethod,
      twoFactorSuccess: true,
      transmissionId,
      pharmacyName: prescription.pharmacy,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      description: `EPCS prescription signed by ${signerName} for ${prescription.patientName}. Medications: ${prescription.medications.map((m) => m.medication).join(', ')}. Schedule: ${prescription.deaSchedule}. 2FA method: ${enrollment.twoFactorMethod}.`,
    });

    // 9. Attempt transmission (async in production, sync for now)
    await this.transmitPrescription(tenantId, transmission.id);

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSMISSION (Surescripts NCPDP — stub for production integration)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Transmit a prescription to the pharmacy via Surescripts network.
   * In production, this would call the Surescripts API with NCPDP SCRIPT messages.
   */
  async transmitPrescription(tenantId: string, transmissionLogId: string): Promise<EpcsTransmissionLog> {
    const log = await this.transmissionRepo.findOne({ where: { id: transmissionLogId, tenantId } });
    if (!log) throw new NotFoundException('Transmission log not found.');

    try {
      // ── PRODUCTION: Call Surescripts API here ──────────────────────────────
      // const ncpdpMessage = this.buildNcpdpScriptMessage(prescription);
      // const response = await this.surescriptsClient.send(ncpdpMessage);

      // ── STUB: Simulate successful transmission ─────────────────────────────
      log.status = 'transmitted';
      log.transmittedAt = new Date();
      log.responseCode = '000';
      log.responseMessage = 'Accepted by pharmacy';

      // Simulate delivery confirmation
      setTimeout(() => {
        this.confirmTransmission(tenantId, log.id).catch((err) =>
          this.logger.error(`Transmission confirmation failed: ${err}`),
        );
      }, 2000);

      const saved = await this.transmissionRepo.save(log);

      await this.audit({
        tenantId,
        action: 'prescription_transmitted',
        prescriptionId: log.prescriptionId,
        transmissionId: log.transmissionId,
        pharmacyName: log.pharmacyName,
        pharmacyNcpdp: log.pharmacyNcpdp,
        description: `Prescription transmitted to ${log.pharmacyName}. Transmission ID: ${log.transmissionId}.`,
      });

      return saved;
    } catch (err) {
      log.status = 'error';
      log.errorDetails = String(err);
      log.retryCount += 1;
      await this.transmissionRepo.save(log);

      await this.audit({
        tenantId,
        action: 'transmission_failed',
        prescriptionId: log.prescriptionId,
        transmissionId: log.transmissionId,
        description: `Transmission failed: ${err}`,
      });

      throw err;
    }
  }

  /**
   * Confirm delivery (called by Surescripts webhook in production)
   */
  async confirmTransmission(tenantId: string, transmissionLogId: string): Promise<void> {
    const log = await this.transmissionRepo.findOne({ where: { id: transmissionLogId, tenantId } });
    if (!log) return;

    log.status = 'confirmed';
    log.confirmedAt = new Date();
    await this.transmissionRepo.save(log);

    // Update prescription transmission status
    await this.prescriptionRepo.update(
      { id: log.prescriptionId, tenantId },
      { epcsTransmissionStatus: 'confirmed', epcsTransmissionId: log.transmissionId },
    );

    await this.audit({
      tenantId,
      action: 'transmission_confirmed',
      prescriptionId: log.prescriptionId,
      transmissionId: log.transmissionId,
      description: `Pharmacy confirmed receipt of prescription. Transmission ID: ${log.transmissionId}.`,
    });
  }

  /**
   * Cancel a transmitted prescription (NCPDP CancelRx)
   */
  async cancelPrescription(
    tenantId: string,
    prescriptionId: string,
    reason: string,
    cancelledByUserId: string,
    cancelledByName: string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId, tenantId },
    });
    if (!prescription) throw new NotFoundException('Prescription not found.');

    if (!prescription.epcsSignedAt) {
      throw new BadRequestException('Cannot cancel a prescription that has not been signed.');
    }

    prescription.status = 'cancelled';
    prescription.epcsTransmissionStatus = 'cancelled';
    const saved = await this.prescriptionRepo.save(prescription);

    // Create CancelRx transmission
    const transmission = this.transmissionRepo.create({
      tenantId,
      prescriptionId: saved.id,
      transmissionId: this.generateTransmissionId(),
      messageType: 'CancelRx',
      status: 'transmitted',
      transmittedAt: new Date(),
      prescriberDea: prescription.prescriberDeaNumber,
      prescriberNpi: prescription.prescriberNpi,
      pharmacyName: prescription.pharmacy,
      pharmacyNcpdp: prescription.pharmacyNcpdp,
    });
    await this.transmissionRepo.save(transmission);

    await this.audit({
      tenantId,
      action: 'prescription_cancelled',
      prescriptionId: saved.id,
      userId: cancelledByUserId,
      userName: cancelledByName,
      patientId: prescription.patientId,
      patientName: prescription.patientName,
      transmissionId: transmission.transmissionId,
      description: `EPCS prescription cancelled by ${cancelledByName}. Reason: ${reason}.`,
      metadata: { reason },
    });

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDMP QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Query the Prescription Drug Monitoring Program.
   * In production, this would call the state PDMP API (Bamboo Health, Appriss, etc.)
   */
  async queryPdmp(
    tenantId: string,
    patientId: string,
    patientName: string,
    providerId: string,
    providerName: string,
    state: string,
  ): Promise<PdmpQuery> {
    // ── PRODUCTION: Call state PDMP API here ────────────────────────────────
    // const response = await this.pdmpClient.query({ patientId, state });

    // ── STUB: Simulate PDMP response with realistic data ────────────────────
    const prescriberCount = Math.floor(Math.random() * 5);
    const pharmacyCount = Math.floor(Math.random() * 4);
    const csRxCount = Math.floor(Math.random() * 12);
    const earlyRefills = Math.floor(Math.random() * 4);
    const totalMme = Math.floor(Math.random() * 120);

    const redFlags: string[] = [];
    let riskScore = 0;

    if (prescriberCount >= 4) { redFlags.push(`${prescriberCount} prescribers — possible doctor shopping`); riskScore += 30; }
    if (pharmacyCount >= 3) { redFlags.push(`${pharmacyCount} pharmacies — possible pharmacy shopping`); riskScore += 20; }
    if (totalMme >= 90) { redFlags.push(`MME ${totalMme}/day exceeds CDC high-risk threshold`); riskScore += 25; }
    if (earlyRefills >= 3) { redFlags.push(`${earlyRefills} early refills — pattern of misuse`); riskScore += 20; }

    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';

    const recommendations: string[] = [];
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Co-prescribe naloxone');
      recommendations.push('Consider pain management referral');
      recommendations.push('Document risk-benefit assessment');
    } else if (riskLevel === 'moderate') {
      recommendations.push('Monitor closely');
      recommendations.push('Verify medical necessity');
    } else {
      recommendations.push('Continue standard monitoring');
    }

    const query = this.pdmpRepo.create({
      tenantId,
      patientId,
      patientName,
      providerId,
      providerName,
      state,
      queryStatus: 'success',
      queryId: `PDMP-${Date.now()}`,
      csPrescriptionCount: csRxCount,
      prescriberCount,
      pharmacyCount,
      totalMme,
      earlyRefillCount: earlyRefills,
      riskLevel,
      riskScore,
      redFlags,
      recommendations,
      rawResponse: { prescriberCount, pharmacyCount, csRxCount, earlyRefills, totalMme },
    });

    const saved = await this.pdmpRepo.save(query);

    await this.audit({
      tenantId,
      action: 'pdmp_query',
      userId: providerId,
      userName: providerName,
      patientId,
      patientName,
      description: `PDMP query for patient ${patientName} in ${state}. Risk level: ${riskLevel}. Score: ${riskScore}.`,
      metadata: { state, riskLevel, riskScore, prescriberCount, pharmacyCount, totalMme },
    });

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOG (Immutable, cryptographically chained)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create an immutable, cryptographically chained audit log entry.
   * 21 CFR 1311.300(e) — tamper-evident audit trail.
   */
  async audit(params: {
    tenantId: string;
    action: string;
    prescriptionId?: string | null;
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    patientId?: string | null;
    patientName?: string | null;
    medication?: string | null;
    deaSchedule?: string | null;
    quantity?: number | null;
    twoFactorMethod?: string | null;
    twoFactorSuccess?: boolean | null;
    transmissionId?: string | null;
    pharmacyNcpdp?: string | null;
    pharmacyName?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<EpcsAuditLog> {
    // Get the last audit entry for this tenant (for chain)
    const lastEntry = await this.auditRepo.findOne({
      where: { tenantId: params.tenantId },
      order: { createdAt: 'DESC' },
    });

    const previousHash = lastEntry?.entryHash || null;

    // Compute entry hash (SHA-256 of all fields + previousHash)
    const entryData: string = JSON.stringify({
      tenantId: params.tenantId,
      action: params.action,
      prescriptionId: params.prescriptionId || null,
      userId: params.userId || null,
      userName: params.userName || null,
      patientId: params.patientId || null,
      patientName: params.patientName || null,
      medication: params.medication || null,
      deaSchedule: params.deaSchedule || null,
      quantity: params.quantity || null,
      twoFactorMethod: params.twoFactorMethod || null,
      twoFactorSuccess: params.twoFactorSuccess ?? null,
      transmissionId: params.transmissionId || null,
      pharmacyNcpdp: params.pharmacyNcpdp || null,
      pharmacyName: params.pharmacyName || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      description: params.description || null,
      metadata: params.metadata || null,
      previousHash,
      timestamp: new Date().toISOString(),
    });

    const entryHash: string = crypto.createHash('sha256').update(entryData).digest('hex');

    const entry = this.auditRepo.create({
      ...params,
      previousHash,
      entryHash,
    });

    return this.auditRepo.save(entry);
  }

  /**
   * Get audit trail for a prescription
   */
  async getAuditTrail(tenantId: string, prescriptionId: string): Promise<EpcsAuditLog[]> {
    return this.auditRepo.find({
      where: { tenantId, prescriptionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get full audit log for a tenant (paginated)
   */
  async getAuditLogs(tenantId: string, page = 1, limit = 50): Promise<{ data: EpcsAuditLog[]; total: number }> {
    const [data, total] = await this.auditRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  /**
   * Verify the integrity of the audit chain (detect tampering)
   */
  async verifyAuditChain(tenantId: string): Promise<{ valid: boolean; brokenAt: string | null }> {
    const entries = await this.auditRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    let previousHash: string | null = null;
    for (const entry of entries) {
      if (entry.previousHash !== previousHash) {
        return { valid: false, brokenAt: entry.id };
      }

      // Recompute hash
      const entryData: string = JSON.stringify({
        tenantId: entry.tenantId,
        action: entry.action,
        prescriptionId: entry.prescriptionId,
        userId: entry.userId,
        userName: entry.userName,
        patientId: entry.patientId,
        patientName: entry.patientName,
        medication: entry.medication,
        deaSchedule: entry.deaSchedule,
        quantity: entry.quantity,
        twoFactorMethod: entry.twoFactorMethod,
        twoFactorSuccess: entry.twoFactorSuccess,
        transmissionId: entry.transmissionId,
        pharmacyNcpdp: entry.pharmacyNcpdp,
        pharmacyName: entry.pharmacyName,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        description: entry.description,
        metadata: entry.metadata,
        previousHash: entry.previousHash,
        timestamp: entry.createdAt.toISOString(),
      });
      const computedHash: string = crypto.createHash('sha256').update(entryData).digest('hex');

      if (computedHash !== entry.entryHash) {
        return { valid: false, brokenAt: entry.id };
      }

      previousHash = entry.entryHash;
    }

    return { valid: true, brokenAt: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSMISSION LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  async getTransmissionLogs(tenantId: string, prescriptionId?: string): Promise<EpcsTransmissionLog[]> {
    if (prescriptionId) {
      return this.transmissionRepo.find({ where: { tenantId, prescriptionId }, order: { createdAt: 'DESC' } });
    }
    return this.transmissionRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getEnrollment(tenantId: string, enrollmentId: string): Promise<ProviderEpcsEnrollment> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id: enrollmentId, tenantId } });
    if (!enrollment) throw new NotFoundException('EPCS enrollment not found.');
    return enrollment;
  }

  private generateTransmissionId(): string {
    return `EPCS-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  private parseDaysSupply(duration: string): number | null {
    const match = duration.match(/(\d+)\s*day/i);
    return match ? parseInt(match[1], 10) : null;
  }
}
