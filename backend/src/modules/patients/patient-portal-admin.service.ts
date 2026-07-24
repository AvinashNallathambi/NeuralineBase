import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Patient } from './entities/patient.entity';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationPriority } from '../notifications/entities/notification.entity';

/**
 * Admin-facing service for managing patient portal access.
 *
 * Responsibilities:
 *  - Enable portal access (issue invitation token, optionally email it)
 *  - Disable portal access (revoke sessions, clear credentials)
 *  - Reset a patient's portal password (admin-triggered)
 *  - Report portal status
 *
 * All mutations are recorded in the HIPAA audit log per 45 CFR 164.312(b).
 */
@Injectable()
export class PatientPortalAdminService {
  private readonly logger = new Logger(PatientPortalAdminService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly hipaaAuditService: HipaaAuditService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get the portal access status for a patient.
   */
  async getStatus(tenantId: string, patientId: string): Promise<{
    portalActive: boolean;
    hasPassword: boolean;
    mfaEnabled: boolean;
    lastLoginAt: Date | null;
    invitationPending: boolean;
    invitationExpiresAt: Date | null;
    email: string | null;
  }> {
    const patient = await this.findPatient(tenantId, patientId);

    const invitationPending =
      !!patient.portalInvitationToken &&
      !!patient.portalInvitationExpiresAt &&
      patient.portalInvitationExpiresAt > new Date() &&
      !patient.passwordHash;

    return {
      portalActive: patient.portalActive,
      hasPassword: !!patient.passwordHash,
      mfaEnabled: patient.mfaEnabled,
      lastLoginAt: patient.lastLoginAt,
      invitationPending,
      invitationExpiresAt: patient.portalInvitationExpiresAt,
      email: patient.email,
    };
  }

  /**
   * Enable portal access for a patient.
   *
   * - Generates a one-time invitation token (valid 7 days)
   * - Sets portalActive = true so the patient can complete setup
   * - Does NOT set a password — the patient must call setup-account
   *   with the invitation token to choose their own password
   * - Optionally emails the invitation link if the patient has an email
   *
   * If the patient already has a password (re-enabling after a disable
   * that kept the credential), the invitation token is still issued but
   * the existing password remains valid.
   */
  async enablePortal(
    tenantId: string,
    patientId: string,
    actor: { userId: string; userEmail: string; userRole: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ invitationToken: string; invitationUrl: string; emailSent: boolean }> {
    const patient = await this.findPatient(tenantId, patientId);

    if (!patient.email) {
      throw new BadRequestException(
        'Patient must have an email on file before portal access can be enabled.',
      );
    }

    const invitationToken = uuidv4();
    const expiresAt = new Date(Date.now() + this.INVITATION_TTL_MS);

    await this.patientRepository.update(patientId, {
      portalActive: true,
      portalInvitationToken: invitationToken,
      portalInvitationExpiresAt: expiresAt,
    });

    await this.audit(
      tenantId,
      actor,
      'PATIENT_PORTAL_ENABLE',
      patientId,
      `Portal access enabled for patient ${patientId}; invitation token issued (expires ${expiresAt.toISOString()})`,
    );

    // Build the invitation URL. The frontend route handles the setup flow.
    const portalUrl = this.buildInvitationUrl(patientId, tenantId, invitationToken);

    // Email the invitation if the patient has an email address.
    let emailSent = false;
    try {
      const notification = await this.notificationsService.notify({
        tenantId,
        type: NotificationType.GENERAL,
        title: 'Your Patient Portal Account is Ready',
        message: `Hello ${patient.firstName},\n\nYour healthcare provider has enabled your patient portal account. Please complete your account setup by visiting the link below and choosing your password.\n\n${portalUrl}\n\nThis link will expire in 7 days.\n\nIf you did not expect this email, please contact your provider's office.`,
        priority: NotificationPriority.HIGH,
        sendEmail: true,
        emailTo: patient.email,
        emailToName: `${patient.firstName} ${patient.lastName}`,
        emailHtmlBody: this.invitationEmailHtml(patient.firstName, portalUrl),
        metadata: {
          kind: 'portal_invitation',
          patientId,
          invitationToken,
          invitationExpiresAt: expiresAt.toISOString(),
        },
      });
      emailSent = !!notification.emailSent;
    } catch (err) {
      this.logger.warn(`Failed to send portal invitation email to ${patient.email}: ${(err as Error).message}`);
    }

    this.logger.log(`Portal enabled for patient ${patientId} by ${actor.userEmail}; emailSent=${emailSent}`);

    return { invitationToken, invitationUrl: portalUrl, emailSent };
  }

  /**
   * Disable portal access for a patient.
   *
   * - Sets portalActive = false (blocks login + token refresh + forgot-password)
   * - Revokes all active patient sessions via the token blacklist
   * - Clears the password hash, MFA secret, reset token, and invitation token
   * - The patient must be re-invited by an admin to regain access
   */
  async disablePortal(
    tenantId: string,
    patientId: string,
    actor: { userId: string; userEmail: string; userRole: string; ipAddress?: string; userAgent?: string },
    reason?: string,
  ): Promise<{ revokedSessions: boolean }> {
    const patient = await this.findPatient(tenantId, patientId);

    await this.patientRepository.update(patientId, {
      portalActive: false,
      passwordHash: null,
      mfaEnabled: false,
      mfaSecret: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      portalInvitationToken: null,
      portalInvitationExpiresAt: null,
    });

    // Revoke all active sessions for this patient (HIPAA §164.312(a)(2)(iii))
    let revokedSessions = false;
    try {
      await this.tokenBlacklist.revokeAllForUser(patientId, {
        userId: patientId,
        tenantId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        reason: reason || 'patient_portal_disabled_by_admin',
      });
      revokedSessions = true;
    } catch (err) {
      this.logger.warn(`Failed to revoke sessions for patient ${patientId}: ${(err as Error).message}`);
    }

    await this.audit(
      tenantId,
      actor,
      'PATIENT_PORTAL_DISABLE',
      patientId,
      `Portal access disabled for patient ${patientId}. Reason: ${reason || 'not specified'}. Sessions revoked: ${revokedSessions}`,
    );

    this.logger.log(`Portal disabled for patient ${patientId} by ${actor.userEmail}`);

    return { revokedSessions };
  }

  /**
   * Admin-triggered password reset.
   *
   * Two modes:
   *  (a) If `temporaryPassword` is provided: sets it as the new password hash,
   *      keeps portalActive = true, and the patient can log in immediately.
   *      The patient should change it at next login (not enforced here).
   *  (b) If `temporaryPassword` is NOT provided: issues a new invitation token
   *      and emails a password-reset link (same as forgot-password, but
   *      triggered by admin and works even if portalActive was false).
   *
   * In both cases, all existing sessions are revoked.
   */
  async resetPassword(
    tenantId: string,
    patientId: string,
    actor: { userId: string; userEmail: string; userRole: string; ipAddress?: string; userAgent?: string },
    options: { temporaryPassword?: string; sendEmail?: boolean } = {},
  ): Promise<{ temporaryPasswordSet: boolean; resetToken?: string; resetUrl?: string; emailSent: boolean }> {
    const patient = await this.findPatient(tenantId, patientId);

    if (!patient.email) {
      throw new BadRequestException('Patient must have an email on file to reset portal password.');
    }

    // Revoke all existing sessions regardless of mode
    try {
      await this.tokenBlacklist.revokeAllForUser(patientId, {
        userId: patientId,
        tenantId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        reason: 'admin_password_reset',
      });
    } catch (err) {
      this.logger.warn(`Failed to revoke sessions during password reset for ${patientId}: ${(err as Error).message}`);
    }

    if (options.temporaryPassword) {
      // Mode (a): set a temporary password directly
      const hashed = await bcrypt.hash(options.temporaryPassword, this.SALT_ROUNDS);
      await this.patientRepository.update(patientId, {
        passwordHash: hashed,
        portalActive: true,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        portalInvitationToken: null,
        portalInvitationExpiresAt: null,
      });

      await this.audit(
        tenantId,
        actor,
        'PATIENT_PORTAL_PASSWORD_RESET_ADMIN',
        patientId,
        `Admin set a temporary password for patient ${patientId}.`,
      );

      this.logger.log(`Admin ${actor.userEmail} set temporary password for patient ${patientId}`);
      return { temporaryPasswordSet: true, emailSent: false };
    }

    // Mode (b): issue a reset token and email it
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.patientRepository.update(patientId, {
      passwordResetToken: resetToken,
      passwordResetExpiresAt: expiresAt,
      portalActive: true, // re-enable so the patient can complete the reset
    });

    const resetUrl = this.buildResetUrl(resetToken);

    let emailSent = false;
    if (options.sendEmail !== false) {
      try {
        const notification = await this.notificationsService.notify({
          tenantId,
          type: NotificationType.GENERAL,
          title: 'Password Reset — Patient Portal',
          message: `Hello ${patient.firstName},\n\nYour healthcare provider has reset your patient portal password. Please choose a new password by visiting the link below.\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not expect this, please contact your provider's office.`,
          priority: NotificationPriority.HIGH,
          sendEmail: true,
          emailTo: patient.email,
          emailToName: `${patient.firstName} ${patient.lastName}`,
          emailHtmlBody: this.resetEmailHtml(patient.firstName, resetUrl),
          metadata: {
            kind: 'portal_password_reset',
            patientId,
            resetToken,
            resetExpiresAt: expiresAt.toISOString(),
          },
        });
        emailSent = !!notification.emailSent;
      } catch (err) {
        this.logger.warn(`Failed to send password reset email to ${patient.email}: ${(err as Error).message}`);
      }
    }

    await this.audit(
      tenantId,
      actor,
      'PATIENT_PORTAL_PASSWORD_RESET_ADMIN',
      patientId,
      `Admin issued a password reset token for patient ${patientId}. Email sent: ${emailSent}`,
    );

    this.logger.log(`Admin ${actor.userEmail} issued password reset for patient ${patientId}; emailSent=${emailSent}`);

    return { temporaryPasswordSet: false, resetToken, resetUrl, emailSent };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async findPatient(tenantId: string, patientId: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found in tenant ${tenantId}`);
    }
    return patient;
  }

  private buildInvitationUrl(patientId: string, tenantId: string, token: string): string {
    const base = process.env.PORTAL_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const params = new URLSearchParams({ tenantId, token });
    return `${base}/patient/setup-account?patientId=${patientId}&${params.toString()}`;
  }

  private buildResetUrl(token: string): string {
    const base = process.env.PORTAL_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${base}/patient/reset-password?token=${token}`;
  }

  private invitationEmailHtml(firstName: string, portalUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0D7C8A;">Your Patient Portal Account is Ready</h2>
        <p>Hello ${firstName},</p>
        <p>Your healthcare provider has enabled your patient portal account. You can now access your appointments, lab results, prescriptions, billing, and securely message your care team online.</p>
        <p>To get started, please complete your account setup by choosing your password:</p>
        <p style="margin: 24px 0;">
          <a href="${portalUrl}"
             style="background: #0D7C8A; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Complete Account Setup
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          This link will expire in 7 days. If you did not expect this email, please contact your provider's office.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          If the button above doesn't work, copy and paste this link into your browser:<br />
          ${portalUrl}
        </p>
      </div>
    `;
  }

  private resetEmailHtml(firstName: string, resetUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0D7C8A;">Password Reset — Patient Portal</h2>
        <p>Hello ${firstName},</p>
        <p>Your healthcare provider has reset your patient portal password. Please choose a new password to regain access to your account.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #0D7C8A; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Choose New Password
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          This link will expire in 1 hour. If you did not expect this email, please contact your provider's office.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          If the button above doesn't work, copy and paste this link into your browser:<br />
          ${resetUrl}
        </p>
      </div>
    `;
  }

  private async audit(
    tenantId: string,
    actor: { userId: string; userEmail: string; userRole: string; ipAddress?: string; userAgent?: string },
    action: string,
    resourceId: string,
    description: string,
  ): Promise<void> {
    try {
      await this.hipaaAuditService.log({
        tenantId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        action,
        resourceType: 'patient_portal_access',
        resourceId,
        description,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    } catch (err) {
      // Audit failures must never block the operation, but we log them.
      this.logger.error(`Audit log failed for ${action}: ${(err as Error).message}`);
    }
  }
}
