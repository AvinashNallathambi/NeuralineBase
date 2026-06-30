import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CreateSuperbillPage from './CreateSuperbillPage';
import { useSuperbillStore } from '../../store/dataStore';
import { Spin } from 'antd';

const EditSuperbillPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { superbills, fetchSuperbills } = useSuperbillStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (superbills.length === 0) {
        await fetchSuperbills();
      }
      setLoading(false);
    };
    load();
  }, [superbills.length, fetchSuperbills]);

  const superbill = superbills.find((s) => s.id === id);

  useEffect(() => {
    if (!loading && !superbill) {
      navigate('/superbills');
    }
  }, [loading, superbill, navigate]);

  if (loading || !superbill) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <CreateSuperbillPage initialData={superbill} />;
};

export default EditSuperbillPage;
