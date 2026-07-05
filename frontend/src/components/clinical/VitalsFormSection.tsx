import React from 'react';
import { Card, Form, Input, Select, InputNumber, Tooltip, Row, Col, DatePicker } from 'antd';
import { HeartOutlined } from '@ant-design/icons';

const { Option } = Select;

function calculateBMI(weightLbs: string, heightIn: string): string {
  const w = parseFloat(weightLbs);
  const h = parseFloat(heightIn);
  if (!w || !h || h === 0) return '';
  return ((w / (h * h)) * 703).toFixed(1);
}

interface VitalsFormSectionProps {
  titleStyle?: React.CSSProperties;
  onWeightHeightChange?: () => void;
}

const VitalsFormSection: React.FC<VitalsFormSectionProps> = ({ titleStyle, onWeightHeightChange }) => {
  const form = Form.useFormInstance();

  const handleWeightHeightChange = () => {
    const weight = form.getFieldValue('weight');
    const height = form.getFieldValue('height');
    if (weight && height) {
      const bmi = calculateBMI(String(weight), String(height));
      if (bmi) {
        form.setFieldsValue({ bmi });
      }
    }
    onWeightHeightChange?.();
  };

  return (
    <Card
      title={<span style={titleStyle}><HeartOutlined /> Vital Signs</span>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 16]}>
        {/* Row 1 */}
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="bloodPressure" label="Blood Pressure">
            <Input placeholder="120/80" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="heartRate" label="Heart Rate (bpm)">
            <Input placeholder="72" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="temperature" label="Temperature (°F)">
            <Input placeholder="98.6" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="temperatureRoute" label="Temp Route">
            <Select allowClear placeholder="Route">
              <Option value="oral">Oral</Option>
              <Option value="rectal">Rectal</Option>
              <Option value="axillary">Axillary</Option>
              <Option value="tympanic">Tympanic</Option>
              <Option value="temporal">Temporal</Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Row 2 */}
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="respiratoryRate" label="Resp Rate (/min)">
            <Input placeholder="16" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="oxygenSaturation" label="O\u2082 Sat (%)">
            <Input placeholder="98" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="weight" label="Weight">
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              onChange={handleWeightHeightChange}
              addonAfter={
                <Form.Item name="weightUnit" noStyle>
                  <Select style={{ width: 60 }} bordered={false} defaultValue="lbs">
                    <Option value="lbs">lbs</Option>
                    <Option value="kg">kg</Option>
                  </Select>
                </Form.Item>
              }
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="height" label="Height">
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              onChange={handleWeightHeightChange}
              addonAfter={
                <Form.Item name="heightUnit" noStyle>
                  <Select style={{ width: 60 }} bordered={false} defaultValue="in">
                    <Option value="in">in</Option>
                    <Option value="cm">cm</Option>
                  </Select>
                </Form.Item>
              }
            />
          </Form.Item>
        </Col>

        {/* Row 3 */}
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="bmi" label={<Tooltip title="Auto-calculated from weight/height">BMI</Tooltip>}>
            <Input
              placeholder="Auto-calc"
              readOnly
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="painScore" label="Pain Score (0–10)">
            <Select allowClear placeholder="Select">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Option key={n} value={n}>{n}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="bloodGlucose" label="Glucose (mg/dL)">
            <Input placeholder="100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="bloodGlucoseContext" label="Glucose Context">
            <Select allowClear placeholder="Context">
              <Option value="fasting">Fasting</Option>
              <Option value="random">Random</Option>
              <Option value="post_meal">Post-meal</Option>
              <Option value="pre_meal">Pre-meal</Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Row 4 */}
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="painLocation" label="Pain Location">
            <Input placeholder="e.g., Lower back" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="headCircumference" label="Head Circ (cm)">
            <Input placeholder="Pediatric" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="waistCircumference" label="Waist Circ (cm)">
            <Input placeholder="e.g., 85" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Form.Item name="recordedDate" label="Recorded Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default VitalsFormSection;
