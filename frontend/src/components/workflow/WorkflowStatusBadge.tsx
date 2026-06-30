import React from 'react';
import { Tag, Tooltip, Steps, Popover } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import type { WorkflowTemplate, WorkflowStepConfig, WorkflowInstance } from '../../types';

interface Props {
  template: WorkflowTemplate;
  instance: WorkflowInstance;
  showSteps?: boolean;
  onTransition?: (toStep: string) => void;
}

const statusIcon = (stepName: string, currentStep: string, status: string) => {
  if (status !== 'active') {
    return status === 'completed' ? <CheckCircleOutlined /> : <CloseCircleOutlined />;
  }
  if (stepName === currentStep) return <ClockCircleOutlined />;
  return <MinusCircleOutlined />;
};

const WorkflowStatusBadge: React.FC<Props> = ({ template, instance, showSteps, onTransition }) => {
  const currentStepConfig = template.steps.find((s) => s.name === instance.currentStep);

  if (!currentStepConfig) {
    return <Tag>{instance.currentStep}</Tag>;
  }

  const sortedSteps = [...template.steps].sort((a, b) => a.order - b.order);

  const stepsContent = (
    <div style={{ minWidth: 250, padding: '8px 0' }}>
      <Steps
        direction="vertical"
        size="small"
        current={sortedSteps.findIndex((s) => s.name === instance.currentStep)}
        status={instance.status === 'cancelled' ? 'error' : instance.status === 'completed' ? 'finish' : 'process'}
        items={sortedSteps.map((step) => {
          const isCurrent = step.name === instance.currentStep;
          const isPast = sortedSteps.indexOf(step) < sortedSteps.indexOf(currentStepConfig);
          const isClickable = currentStepConfig.allowedTransitions.includes(step.name) && instance.status === 'active';

          return {
            title: (
              <span
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  color: isClickable ? '#1890ff' : undefined,
                  fontWeight: isCurrent ? 600 : undefined,
                }}
                onClick={() => isClickable && onTransition?.(step.name)}
              >
                {step.label}
              </span>
            ),
            status: isCurrent
              ? 'process'
              : isPast
                ? 'finish'
                : 'wait',
            icon: statusIcon(step.name, instance.currentStep, instance.status),
          };
        })}
      />
      {instance.history.length > 1 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          Last: {instance.history[instance.history.length - 1]?.fromStep || 'Started'} &rarr;{' '}
          {instance.history[instance.history.length - 1]?.toStep}
        </div>
      )}
    </div>
  );

  const badge = (
    <Tag
      color={currentStepConfig.color}
      style={{ cursor: 'pointer' }}
      icon={statusIcon(instance.currentStep, instance.currentStep, instance.status)}
    >
      {currentStepConfig.label}
      {instance.status !== 'active' && (
        <span style={{ marginLeft: 4 }}>({instance.status})</span>
      )}
    </Tag>
  );

  if (showSteps) {
    return stepsContent;
  }

  return (
    <Popover content={stepsContent} title={template.name} trigger="click">
      {badge}
    </Popover>
  );
};

export default WorkflowStatusBadge;
