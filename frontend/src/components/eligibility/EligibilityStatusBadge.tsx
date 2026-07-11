import React from 'react';
import { Tag, Tooltip, Space } from 'antd';
import type { EligibilityVerificationStatus, EligibilityCoverageStatus } from '../../types';

interface EligibilityStatusBadgeProps {
  status?: EligibilityVerificationStatus;
  coverageStatus?: EligibilityCoverageStatus;
  compact?: boolean;
  showCoverage?: boolean;
}

const statusColors: Record<EligibilityVerificationStatus, string> = {
  pending: 'gold',
  active: 'green',
  inactive: 'orange',
  failed: 'red',
  error: 'red',
};

const coverageColors: Record<EligibilityCoverageStatus, string> = {
  active: 'green',
  inactive: 'orange',
  terminated: 'red',
  unknown: 'default',
};

export const EligibilityStatusBadge: React.FC<EligibilityStatusBadgeProps> = ({
  status = 'pending',
  coverageStatus = 'unknown',
  compact = false,
  showCoverage = true,
}) => {
  const label = status.replace(/_/g, ' ').toUpperCase();
  const coverageLabel = coverageStatus.replace(/_/g, ' ').toUpperCase();

  if (compact) {
    return (
      <Tooltip title={`Verification: ${label} | Coverage: ${coverageLabel}`}>
        <Tag color={statusColors[status]}>{label}</Tag>
      </Tooltip>
    );
  }

  return (
    <Space size="small">
      <Tag color={statusColors[status]}>{label}</Tag>
      {showCoverage && <Tag color={coverageColors[coverageStatus]}>{coverageLabel}</Tag>}
    </Space>
  );
};

export default EligibilityStatusBadge;
