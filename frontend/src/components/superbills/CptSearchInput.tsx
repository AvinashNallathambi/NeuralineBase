import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Select, Empty } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { cptService, type CptCode } from '../../services/cptService';

export interface CptCodeOption {
  code: string;
  description: string;
  price?: number;
}

interface CptSearchInputProps {
  value?: string;
  onSelect: (code: string, description: string, price?: number) => void;
  /** Optional static options (if provided, skips backend search) */
  options?: CptCodeOption[];
  placeholder?: string;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  style?: React.CSSProperties;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span
            key={i}
            style={{
              background: '#fff7b0',
              fontWeight: 600,
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

const CptSearchInput: React.FC<CptSearchInputProps> = ({
  value,
  onSelect,
  options: staticOptions,
  placeholder = 'Search CPT/HCPCS code...',
  size = 'middle',
  disabled,
  style,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendResults, setBackendResults] = useState<CptCode[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const useBackend = !staticOptions || staticOptions.length === 0;

  const staticAllOptions = useMemo(
    () =>
      (staticOptions || []).map((c) => ({
        value: c.code,
        label: `${c.code} - ${c.description}`,
        description: c.description,
        price: c.price,
        code: c.code,
      })),
    [staticOptions],
  );

  useEffect(() => {
    if (!useBackend) {
      setLoading(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(searchValue);
        setLoading(false);
      }, 150);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
    // Backend search mode
    if (!searchValue.trim()) {
      setBackendResults([]);
      setLoading(false);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await cptService.search(searchValue, 25, 0);
        if (!controller.signal.aborted) {
          setBackendResults(res.data);
          setDebouncedValue(searchValue);
        }
      } catch {
        if (!controller.signal.aborted) setBackendResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [searchValue, useBackend]);

  const backendAllOptions = useMemo(
    () =>
      backendResults.map((c) => ({
        value: c.code,
        label: `${c.code} - ${c.description}`,
        description: c.description,
        price: c.defaultCharge ? Number(c.defaultCharge) : undefined,
        code: c.code,
      })),
    [backendResults],
  );

  const allOptions = useBackend ? backendAllOptions : staticAllOptions;

  const filteredOptions = useMemo(() => {
    if (useBackend) return allOptions;
    const q = debouncedValue.toLowerCase().trim();
    if (!q) return allOptions;
    return allOptions.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q),
    );
  }, [allOptions, debouncedValue, useBackend]);

  const renderedOptions = useMemo(
    () =>
      filteredOptions.map((o) => ({
        value: o.value,
        label: highlightMatch(o.label, debouncedValue),
        description: o.description,
        price: o.price,
        code: o.code,
      })),
    [filteredOptions, debouncedValue],
  );

  const handleSelect = (selectedValue: string | undefined) => {
    if (!selectedValue) {
      onSelect('', '', 0);
      return;
    }
    const option = allOptions.find((o) => o.value === selectedValue);
    if (option) {
      onSelect(option.code, option.description, option.price);
    }
  };

  const suffixIcon = loading ? <LoadingOutlined /> : undefined;

  return (
    <Select
      showSearch
      allowClear
      value={value || undefined}
      placeholder={placeholder}
      size={size}
      disabled={disabled}
      style={style}
      onSearch={setSearchValue}
      onChange={handleSelect}
      onClear={() => onSelect('', '', 0)}
      filterOption={false}
      options={renderedOptions}
      suffixIcon={suffixIcon}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <LoadingOutlined />
          </div>
        ) : (
          <Empty description="No matching CPT code" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )
      }
    />
  );
};

export default CptSearchInput;
