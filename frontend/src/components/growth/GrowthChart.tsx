import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Typography, Tag, Empty, Space, Alert } from 'antd';
import type { GrowthDataPoint, PercentileCurve } from '../../services/growthService';

const { Text } = Typography;

interface GrowthChartProps {
  title: string;
  unit: string;
  dataPoints: GrowthDataPoint[];
  curves: PercentileCurve[];
  midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number } | null;
  color?: string;
}

const percentileColors: Record<string, string> = {
  p3: '#ff4d4f',
  p5: '#ff7a45',
  p10: '#ffa940',
  p25: '#bae637',
  p50: '#52c41a',
  p75: '#bae637',
  p90: '#ffa940',
  p95: '#ff7a45',
  p97: '#ff4d4f',
};

const percentileLabels: Record<string, string> = {
  p3: '3rd',
  p5: '5th',
  p10: '10th',
  p25: '25th',
  p50: '50th',
  p75: '75th',
  p90: '90th',
  p95: '95th',
  p97: '97th',
};

const GrowthChart: React.FC<GrowthChartProps> = ({
  title,
  unit,
  dataPoints,
  curves,
  midParentalHeight,
  color = '#0D7C8A',
}) => {
  // Merge curve data and patient data points into a single dataset keyed by age
  const chartData = useMemo(() => {
    const allAges = new Set<number>();
    curves.forEach((c) => allAges.add(c.ageMonths));
    dataPoints.forEach((d) => allAges.add(d.ageMonths));

    const sortedAges = Array.from(allAges).sort((a, b) => a - b);

    return sortedAges.map((age) => {
      const curve = curves.find((c) => c.ageMonths === age);
      const point = dataPoints.find((d) => d.ageMonths === age);

      return {
        ageMonths: age,
        p3: curve?.p3,
        p5: curve?.p5,
        p10: curve?.p10,
        p25: curve?.p25,
        p50: curve?.p50,
        p75: curve?.p75,
        p90: curve?.p90,
        p95: curve?.p95,
        p97: curve?.p97,
        patientValue: point?.value,
        patientPercentile: point?.percentile,
        patientDate: point?.encounterDate,
        patientZScore: point?.zScore,
      };
    });
  }, [curves, dataPoints]);

  if (dataPoints.length === 0 && curves.length === 0) {
    return (
      <div>
        <Text strong style={{ fontSize: 14 }}>{title}</Text>
        <Empty description={`No ${title.toLowerCase()} data available`} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const latestPoint = dataPoints.length > 0 ? dataPoints[0] : null;
  const hasData = dataPoints.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space>
          <Text strong style={{ fontSize: 14 }}>{title}</Text>
          {latestPoint && (
            <Tag color={color}>
              Latest: {latestPoint.percentile}th percentile
            </Tag>
          )}
        </Space>
        {latestPoint && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {latestPoint.value} {unit} · {latestPoint.encounterDate} · {latestPoint.source}
          </Text>
        )}
      </div>

      {!hasData && (
        <Alert
          type="info"
          showIcon
          message="No measurements recorded yet"
          description="Growth percentile curves are shown. Record vitals during encounters to plot the patient's growth."
          style={{ marginBottom: 12 }}
        />
      )}

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="ageMonths"
            type="number"
            domain={['dataMin', 'dataMax']}
            label={{ value: 'Age (months)', position: 'bottom', offset: -5 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: unit, angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 11 }}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip
            formatter={(value: any, name: string) => {
              if (name === 'patientValue' && value != null) {
                const entry = chartData.find((d) => d.patientValue === value);
                return [`${value} ${unit} (${entry?.patientPercentile ?? '?'}th %ile)`, 'Patient'];
              }
              if (typeof value === 'number') {
                return [`${value} ${unit}`, percentileLabels[name] || name];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `Age: ${label} months`}
          />
          <Legend
            formatter={(value) => percentileLabels[value] || (value === 'patientValue' ? 'Patient' : value)}
            wrapperStyle={{ fontSize: 11 }}
          />

          {/* Percentile curves */}
          <Line type="monotone" dataKey="p3" stroke={percentileColors.p3} strokeWidth={1} dot={false} strokeDasharray="2 2" />
          <Line type="monotone" dataKey="p5" stroke={percentileColors.p5} strokeWidth={1} dot={false} strokeDasharray="2 2" />
          <Line type="monotone" dataKey="p10" stroke={percentileColors.p10} strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p25" stroke={percentileColors.p25} strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p50" stroke={percentileColors.p50} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p75" stroke={percentileColors.p75} strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p90" stroke={percentileColors.p90} strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p95" stroke={percentileColors.p95} strokeWidth={1} dot={false} strokeDasharray="2 2" />
          <Line type="monotone" dataKey="p97" stroke={percentileColors.p97} strokeWidth={1} dot={false} strokeDasharray="2 2" />

          {/* Patient data points */}
          <Scatter dataKey="patientValue" fill={color} size={6} />

          {/* Mid-parental height reference lines (only for height chart) */}
          {midParentalHeight && (
            <>
              <ReferenceLine y={midParentalHeight.targetHeightCm} stroke="#722ed1" strokeDasharray="5 5" label={{ value: `Target: ${midParentalHeight.targetHeightCm}cm`, position: 'right', fontSize: 10 }} />
              <ReferenceLine y={midParentalHeight.rangeLowCm} stroke="#722ed1" strokeDasharray="3 3" opacity={0.4} />
              <ReferenceLine y={midParentalHeight.rangeHighCm} stroke="#722ed1" strokeDasharray="3 3" opacity={0.4} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GrowthChart;
