import React, { useEffect, useState } from 'react';
import { Card, Typography, Spin, Empty, Space, Tag, Alert } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { growthService } from '../../services/growthService';
import type { GrowthChartResponse } from '../../services/growthService';
import GrowthChart from '../../components/growth/GrowthChart';

const { Title, Text } = Typography;

const PortalGrowthChartPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GrowthChartResponse | null>(null);

  useEffect(() => {
    loadGrowthData();
  }, []);

  const loadGrowthData = async () => {
    setLoading(true);
    try {
      const result = await growthService.portalGetMyGrowthChart();
      setData(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!data) {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>
          <LineChartOutlined /> Growth Charts
        </Title>
        <Card>
          <Empty description="Growth chart data is not available yet. Your provider will record growth measurements during your visits." />
        </Card>
      </div>
    );
  }

  const hasAnyData =
    data.measurements.weight.length > 0 ||
    data.measurements.height.length > 0 ||
    data.measurements.headCircumference.length > 0 ||
    data.measurements.bmi.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
          <LineChartOutlined /> Growth Charts
        </Title>
        <Space size="large">
          <Tag color={data.sex === 'male' ? 'blue' : 'pink'}>
            {data.sex === 'male' ? 'Male' : 'Female'}
          </Tag>
          {data.gestationalAgeWeeks && data.gestationalAgeWeeks < 37 && (
            <Tag color="orange">
              Born at {data.gestationalAgeWeeks} weeks (adjusted age used)
            </Tag>
          )}
          {data.midParentalHeight && (
            <Tag color="purple">
              Target Adult Height: {data.midParentalHeight.targetHeightCm}cm
              (range {data.midParentalHeight.rangeLowCm}–{data.midParentalHeight.rangeHighCm}cm)
            </Tag>
          )}
        </Space>
      </div>

      {!hasAnyData && (
        <Alert
          type="info"
          showIcon
          message="No growth measurements recorded yet"
          description="Your growth measurements (weight, height, head circumference) will be plotted here after your provider records them during visits."
          style={{ marginBottom: 24 }}
        />
      )}

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card size="small">
          <GrowthChart
            title="Weight-for-Age"
            unit="kg"
            dataPoints={data.measurements.weight}
            curves={data.percentileCurves.weight}
            color="#0D7C8A"
          />
        </Card>

        <Card size="small">
          <GrowthChart
            title="Height/Length-for-Age"
            unit="cm"
            dataPoints={data.measurements.height}
            curves={data.percentileCurves.height}
            midParentalHeight={data.midParentalHeight}
            color="#52c41a"
          />
        </Card>

        {data.measurements.headCircumference.length > 0 || data.percentileCurves.headCircumference.length > 0 ? (
          <Card size="small">
            <GrowthChart
              title="Head Circumference-for-Age"
              unit="cm"
              dataPoints={data.measurements.headCircumference}
              curves={data.percentileCurves.headCircumference}
              color="#722ed1"
            />
          </Card>
        ) : null}

        {data.measurements.bmi.length > 0 || data.percentileCurves.bmi.length > 0 ? (
          <Card size="small">
            <GrowthChart
              title="BMI-for-Age"
              unit="kg/m²"
              dataPoints={data.measurements.bmi}
              curves={data.percentileCurves.bmi}
              color="#fa8c16"
            />
          </Card>
        ) : null}
      </Space>
    </div>
  );
};

export default PortalGrowthChartPage;
