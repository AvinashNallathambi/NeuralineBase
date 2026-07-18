import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Space,
  Empty,
  Skeleton,
  message,
  Dropdown,
  Switch,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  MoreOutlined,
  EditOutlined,
  CopyOutlined,
  SnippetsOutlined,
  DeleteOutlined,
  StarFilled,
  StarOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ClinicalTemplate } from '../../types';
import { clinicalTemplateService } from '../../services/clinicalTemplateService';
import { useAuthStore } from '../../store';
import ClinicalTemplateCard from './ClinicalTemplateCard';
import NewTemplateCard from './NewTemplateCard';
import ClinicalTemplateFormModal from './ClinicalTemplateFormModal';

const { Text } = Typography;
const { Option } = Select;

const ClinicalTemplateGallery: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'super_admin';

  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [visitTypeFilter, setVisitTypeFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('name');
  const [showInactive, setShowInactive] = useState(false);

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [visitTypes, setVisitTypes] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClinicalTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await clinicalTemplateService.findAll({
        limit: 100,
        search: search.trim() || undefined,
        specialty: specialtyFilter !== 'all' ? specialtyFilter : undefined,
        visitType: visitTypeFilter !== 'all' ? visitTypeFilter : undefined,
        sort,
        status: showInactive ? undefined : 'active',
      });
      setTemplates(result.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, specialtyFilter, visitTypeFilter, sort, showInactive]);

  const fetchFilters = useCallback(async () => {
    try {
      const [specs, vts] = await Promise.all([
        clinicalTemplateService.findSpecialties(),
        clinicalTemplateService.findVisitTypes(),
      ]);
      setSpecialties(specs);
      setVisitTypes(vts);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleReset = () => {
    setSearch('');
    setSpecialtyFilter('all');
    setVisitTypeFilter('all');
    setSort('name');
    setShowInactive(false);
  };

  const handleUseTemplate = (template: ClinicalTemplate) => {
    navigate(`/clinical/new?templateId=${template.id}`);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const handleEdit = (template: ClinicalTemplate) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleDuplicate = async (template: ClinicalTemplate) => {
    try {
      await clinicalTemplateService.duplicate(template.id);
      message.success('Template duplicated');
      fetchTemplates();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to duplicate');
    }
  };

  const handleDelete = async (template: ClinicalTemplate) => {
    try {
      await clinicalTemplateService.delete(template.id);
      message.success('Template deleted');
      fetchTemplates();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to delete');
    }
  };

  const handleArchive = async (template: ClinicalTemplate) => {
    try {
      await clinicalTemplateService.archive(template.id);
      message.success('Template archived');
      fetchTemplates();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to archive');
    }
  };

  const handleToggleFavorite = async (template: ClinicalTemplate) => {
    try {
      await clinicalTemplateService.toggleFavorite(template.id);
      fetchTemplates();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to update');
    }
  };

  const menuItems = (template: ClinicalTemplate): MenuProps['items'] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditOutlined />,
      onClick: () => handleEdit(template),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: <CopyOutlined />,
      onClick: () => handleDuplicate(template),
    },
    {
      key: 'favorite',
      label: template.isFavorite ? 'Remove Favorite' : 'Add Favorite',
      icon: template.isFavorite ? <StarFilled /> : <StarOutlined />,
      onClick: () => handleToggleFavorite(template),
    },
    {
      key: 'archive',
      label: 'Archive',
      onClick: () => handleArchive(template),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      disabled: !isAdmin,
      onClick: () => handleDelete(template),
    },
  ];

  const renderCard = (template: ClinicalTemplate) => (
    <div style={{ position: 'relative' }}>
      <ClinicalTemplateCard template={template} onClick={handleUseTemplate} />
      <Dropdown menu={{ items: menuItems(template) }} trigger={['click']} placement="bottomRight">
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
          onClick={(e) => e.stopPropagation()}
        />
      </Dropdown>
    </div>
  );

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 16 }}>    
         <Typography.Title  level={4} style={{ marginBottom: 16,color: '#262626' }}>
      <SnippetsOutlined/>  Clinical Templates
      </Typography.Title>
      </div>

      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8} lg={6}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Specialty"
              value={specialtyFilter}
              onChange={(v) => setSpecialtyFilter(v)}
              allowClear={false}
            >
              <Option value="all">All Specialties</Option>
              {specialties.map((s) => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Visit Type"
              value={visitTypeFilter}
              onChange={(v) => setVisitTypeFilter(v)}
              allowClear={false}
            >
              <Option value="all">All Visit Types</Option>
              {visitTypes.map((v) => (
                <Option key={v} value={v}>{v}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Sort by"
              value={sort}
              onChange={(v) => setSort(v)}
            >
              <Option value="name">Name</Option>
              <Option value="specialty">Specialty</Option>
              <Option value="newest">Newest</Option>
              <Option value="mostUsed">Most Used</Option>
              <Option value="recentlyUsed">Recently Used</Option>
            </Select>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                Reset
              </Button>
              <Button type="primary" icon={<AppstoreAddOutlined />} onClick={handleCreate}>
                New
              </Button>
            </Space>
          </Col>
        </Row>

        <Row style={{ marginTop: 12 }}>
          <Col>
            <Space>
              <Switch
                checked={showInactive}
                onChange={setShowInactive}
                size="small"
              />
              <Text style={{ fontSize: 13 }}>Show inactive</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} md={8} lg={6}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Col>
          ))}
        </Row>
      ) : templates.length === 0 ? (
        <Card style={{ borderRadius: 8 }}>
          <Empty
            description="No templates found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleCreate}>
              Create Template
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <NewTemplateCard onClick={handleCreate} />
          </Col>
          {templates.map((template) => (
            <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
              {renderCard(template)}
            </Col>
          ))}
        </Row>
      )}

      <ClinicalTemplateFormModal
        open={formOpen}
        template={editingTemplate}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchTemplates}
      />
    </div>
  );
};

export default ClinicalTemplateGallery;
