import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HipaaAuditService } from './services/hipaa-audit.service';
import { EncryptionService } from './services/encryption.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { TenantWipeService } from './services/tenant-wipe.service';
import { HipaaAuditLog } from './entities/hipaa-audit-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([HipaaAuditLog])],
  providers: [HipaaAuditService, EncryptionService, PasswordPolicyService, TenantWipeService],
  exports: [HipaaAuditService, EncryptionService, PasswordPolicyService, TenantWipeService],
})
export class CommonModule {}
