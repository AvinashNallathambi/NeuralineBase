import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { InsuranceVerification } from '../eligibility/entities/insurance-verification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationPriority } from '../notifications/entities/notification.entity';

export interface CoverageGap {
  patientId: string;
  patientName: string;
  appointmentId: string;
  appointmentDate: Date;
  gapType: 'no_insurance' | 'expired_policy' | 'expiring_soon' | 'no_recent_verification' | 'inactive_policy';
  severity: 'critical' | 'warning' | 'info';
  details: string;
  recommendedAction: string;
}

@Injectable()
export class CoverageGapDetectorService implements OnModuleInit {
  private readonly logger = new Logger(CoverageGapDetectorService.name);
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepository: Repository<PatientInsurance>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(InsuranceVerification)
    private readonly verificationRepository: Repository<InsuranceVerification>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Coverage gap detector initialized');
    // Run daily at 6 AM via setInterval (simpler than Bull queue for this use case)
    // In production, use a cron library or Bull repeatable job
    const DAY_MS = 24 * 60 * 60 * 1000;
    this.scanInterval = setInterval(() => {
      this.scanCoverageGaps().catch((err) =>
        this.logger.error(`Coverage gap scan failed: ${err.message}`),
      );
    }, DAY_MS);

    // Also run once on startup (after 30 seconds delay for app to fully boot)
    setTimeout(() => {
      this.scanCoverageGaps().catch((err) =>
        this.logger.error(`Initial coverage gap scan failed: ${err.message}`),
      );
    }, 30000);
  }

  /**
   * Scan all patients with upcoming appointments for insurance coverage gaps.
   * Looks at appointments in the next 7 days.
   */
  async scanCoverageGaps(daysAhead = 7): Promise<CoverageGap[]> {
    this.logger.log(`Scanning for coverage gaps (appointments in next ${daysAhead} days)...`);

    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Find all scheduled appointments in the next N days
    const appointments = await this.appointmentRepository.find({
      where: {
        startTime: MoreThanOrEqual(now),
        status: 'scheduled' as any,
      },
      order: { startTime: 'ASC' },
    });

    // Filter to only those within the window
    const upcomingAppts = appointments.filter(
      (a) => new Date(a.startTime) <= futureDate && a.patientId,
    );

    this.logger.log(`Found ${upcomingAppts.length} upcoming appointments to check`);

    const gaps: CoverageGap[] = [];

    for (const appt of upcomingAppts) {
      const patientGaps = await this.checkPatientCoverage(
        appt.tenantId,
        appt.patientId!,
        appt.patientName || 'Unknown',
        appt.id,
        appt.startTime,
      );
      gaps.push(...patientGaps);
    }

    // Create notifications for each gap
    for (const gap of gaps) {
      await this.createGapNotification(gap);
    }

    this.logger.log(`Coverage gap scan complete: found ${gaps.length} gaps`);
    return gaps;
  }

  /**
   * Check a single patient's coverage for a specific appointment.
   */
  private async checkPatientCoverage(
    tenantId: string,
    patientId: string,
    patientName: string,
    appointmentId: string,
    appointmentDate: Date,
  ): Promise<CoverageGap[]> {
    const gaps: CoverageGap[] = [];
    const apptDate = new Date(appointmentDate);

    // Get all active insurance policies
    const insurances = await this.insuranceRepository.find({
      where: { patientId, tenantId, status: 'active' },
      relations: ['payer'],
    });

    // Gap 1: No insurance on file
    if (insurances.length === 0) {
      gaps.push({
        patientId,
        patientName,
        appointmentId,
        appointmentDate: apptDate,
        gapType: 'no_insurance',
        severity: 'critical',
        details: 'Patient has no active insurance policies on file.',
        recommendedAction: 'Contact patient to collect insurance information before appointment. Screen for Medicaid/marketplace eligibility if needed.',
      });
      return gaps; // No point checking further
    }

    // Check each policy
    for (const ins of insurances) {
      // Gap 2: Expired policy
      if (ins.expirationDate) {
        const expDate = new Date(ins.expirationDate);
        if (expDate < new Date()) {
          gaps.push({
            patientId,
            patientName,
            appointmentId,
            appointmentDate: apptDate,
            gapType: 'expired_policy',
            severity: 'critical',
            details: `Policy with ${ins.payer?.name || 'Unknown'} (Policy #${ins.policyNumber}) expired on ${expDate.toISOString().split('T')[0]}.`,
            recommendedAction: 'Request updated insurance card from patient. Re-verify eligibility if policy was renewed.',
          });
        } else {
          // Gap 3: Expiring soon (within 30 days)
          const daysUntilExpiry = Math.floor(
            (expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilExpiry <= 30) {
            gaps.push({
              patientId,
              patientName,
              appointmentId,
              appointmentDate: apptDate,
              gapType: 'expiring_soon',
              severity: 'warning',
              details: `Policy with ${ins.payer?.name || 'Unknown'} expires in ${daysUntilExpiry} days (on ${expDate.toISOString().split('T')[0]}).`,
              recommendedAction: 'Remind patient to bring updated insurance card to appointment.',
            });
          }
        }
      }

      // Gap 4: Inactive status (shouldn't happen since we filter for active, but double-check)
      if (ins.status !== 'active') {
        gaps.push({
          patientId,
          patientName,
          appointmentId,
          appointmentDate: apptDate,
          gapType: 'inactive_policy',
          severity: 'critical',
          details: `Policy with ${ins.payer?.name || 'Unknown'} has status '${ins.status}'.`,
          recommendedAction: 'Update policy status or add new active insurance.',
        });
      }
    }

    // Gap 5: No recent eligibility verification (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentVerifications = await this.verificationRepository.find({
      where: {
        tenantId,
        patientId,
        verifiedAt: MoreThanOrEqual(thirtyDaysAgo),
      },
      order: { verifiedAt: 'DESC' },
      take: 1,
    });

    if (recentVerifications.length === 0) {
      gaps.push({
        patientId,
        patientName,
        appointmentId,
        appointmentDate: apptDate,
        gapType: 'no_recent_verification',
        severity: 'warning',
        details: 'No eligibility verification in the last 30 days.',
        recommendedAction: 'Run eligibility verification (270/271) before the appointment to confirm active coverage.',
      });
    }

    return gaps;
  }

  /**
   * Create a notification for a coverage gap.
   */
  private async createGapNotification(gap: CoverageGap): Promise<void> {
    const priorityMap = {
      critical: NotificationPriority.URGENT,
      warning: NotificationPriority.HIGH,
      info: NotificationPriority.MEDIUM,
    };

    const titleMap = {
      no_insurance: 'No Insurance on File',
      expired_policy: 'Expired Insurance Policy',
      expiring_soon: 'Insurance Expiring Soon',
      no_recent_verification: 'Eligibility Verification Needed',
      inactive_policy: 'Inactive Insurance Policy',
    };

    try {
      await this.notificationsService.notify({
        tenantId: 'default-tenant', // Will be set properly in multi-tenant context
        type: NotificationType.GENERAL,
        title: `[${gap.severity.toUpperCase()}] ${titleMap[gap.gapType]}: ${gap.patientName}`,
        message: `${gap.details}\n\nAppointment: ${new Date(gap.appointmentDate).toLocaleString()}\n\nRecommended action: ${gap.recommendedAction}`,
        priority: priorityMap[gap.severity],
        actionUrl: `/patients/${gap.patientId}`,
        actionLabel: 'View Patient',
        metadata: {
          gapType: gap.gapType,
          patientId: gap.patientId,
          appointmentId: gap.appointmentId,
          appointmentDate: gap.appointmentDate,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to create gap notification: ${err.message}`);
    }
  }

  /**
   * Get coverage gaps for a specific patient (on-demand check).
   */
  async checkPatientOnDemand(patientId: string, tenantId: string): Promise<CoverageGap[]> {
    // Get upcoming appointments for this patient
    const appointments = await this.appointmentRepository.find({
      where: {
        patientId,
        tenantId,
        startTime: MoreThanOrEqual(new Date()),
        status: 'scheduled' as any,
      },
      order: { startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      // No upcoming appointments — just check insurance status
      const insurances = await this.insuranceRepository.find({
        where: { patientId, tenantId, status: 'active' },
        relations: ['payer'],
      });

      if (insurances.length === 0) {
        return [{
          patientId,
          patientName: 'Unknown',
          appointmentId: '',
          appointmentDate: new Date(),
          gapType: 'no_insurance',
          severity: 'critical',
          details: 'Patient has no active insurance policies on file.',
          recommendedAction: 'Add insurance information for this patient.',
        }];
      }

      return [];
    }

    const allGaps: CoverageGap[] = [];
    for (const appt of appointments) {
      const gaps = await this.checkPatientCoverage(
        tenantId,
        patientId,
        appt.patientName || 'Unknown',
        appt.id,
        appt.startTime,
      );
      allGaps.push(...gaps);
    }

    return allGaps;
  }
}
