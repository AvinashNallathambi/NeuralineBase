import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Input, Typography, Space, Spin, Tag, Empty, Tooltip } from 'antd';
import { SearchOutlined, GlobalOutlined } from '@ant-design/icons';
import { codesService, type UnifiedCodeResult, type CodeSystem } from '../../services/codesService';

const { Text } = Typography;

interface CodeSearchInputProps {
  value?: string;
  description?: string;
  codeSystem?: string;
  onSelect: (selection: {
    code: string;
    description: string;
    codeSystem: string;
    isBillable?: boolean;
    isProcedure?: boolean;
    category?: string | null;
  }) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Restrict search to specific code systems. Default: all. */
  allowedTypes?: CodeSystem[];
  style?: React.CSSProperties;
}

const SYSTEM_COLORS: Record<string, string> = {
  'ICD-10-CM': 'blue',
  'ICD-9-CM': 'cyan',
  'SNOMED CT': 'geekblue',
  'ICD-11': 'purple',
  CPT: 'green',
  HCPCS: 'gold',
  LOINC: 'magenta',
  CUSTOM: 'default',
  'Patient Problems': 'orange',
  Favorites: 'gold',
  Recent: 'default',
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} style={{ background: '#fff7b0', fontWeight: 600, borderRadius: 2, padding: '0 1px' }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

const CodeSearchInput: React.FC<CodeSearchInputProps> = ({
  value = '',
  description: desc = '',
  codeSystem: initialCodeSystem,
  onSelect,
  placeholder = 'Search ICD-10, ICD-9, CPT, HCPCS, SNOMED, or custom code...',
  autoFocus = false,
  allowedTypes,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || desc || '');
  const [results, setResults] = useState<UnifiedCodeResult[]>([]);
  const [grouped, setGrouped] = useState<Record<string, UnifiedCodeResult[]>>({});
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(
    async (q: string) => {
      if (abortRef.current) abortRef.current.abort();
      if (!q.trim()) {
        setResults([]);
        setGrouped({});
        setNoResults(false);
        setOpen(false);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setNoResults(false);
      try {
        const res = await codesService.search(q, allowedTypes, 25);
        if (controller.signal.aborted) return;
        setResults(res.results);
        setGrouped(res.grouped || {});
        setNoResults(res.results.length === 0);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setGrouped({});
          setNoResults(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [allowedTypes],
  );

  const debouncedSearch = useCallback(
    (q: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => performSearch(q), 150);
    },
    [performSearch],
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    debouncedSearch(q);
  };

  const handleSelect = (item: UnifiedCodeResult) => {
    setQuery(`${item.code} - ${item.description}`);
    onSelect({
      code: item.code,
      description: item.description,
      codeSystem: item.codeSystem,
      isBillable: item.isBillable,
      isProcedure: item.isProcedure,
      category: item.category,
    });
    setOpen(false);
    setResults([]);
    setGrouped({});
    setNoResults(false);
  };

  const allItems = useMemo(() => results, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || allItems.length === 0) {
      if (e.key === 'Enter') setOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allItems.length) {
          handleSelect(allItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = () => {
    if (allItems.length > 0 || noResults) setOpen(true);
  };

  const groupEntries = Object.entries(grouped);

  let flatIndex = 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        suffix={loading ? <Spin size="small" /> : null}
        autoFocus={autoFocus}
      />

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            maxHeight: 400,
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            border: '1px solid #d9d9d9',
            marginTop: 4,
          }}
        >
          {noResults ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">No codes found for "{query}"</Text>
                    <Tooltip title="Search external code databases">
                      <a
                        href={`https://icd10cmtool.cms.gov/?search=${encodeURIComponent(query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <GlobalOutlined /> Search external databases
                      </a>
                    </Tooltip>
                  </Space>
                }
              />
            </div>
          ) : (
            groupEntries.map(([groupName, items]) => (
              <div key={groupName}>
                {/* Group header */}
                <div
                  style={{
                    padding: '6px 12px',
                    background: '#f5f5f5',
                    borderBottom: '1px solid #e8e8e8',
                    borderTop: '1px solid #e8e8e8',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Space size={4}>
                    <Text style={{ fontSize: 12, color: '#595959', fontWeight: 600 }}>{groupName}</Text>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>({items.length})</Text>
                  </Space>
                </div>
                {/* Items */}
                {items.map((item) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={`${item.codeSystem}-${item.code}-${idx}`}
                      data-index={idx}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isSelected ? '#e6f7ff' : undefined,
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(item)}
                    >
                      <Space direction="vertical" size={0} style={{ flex: 1 }}>
                        <Space size={8}>
                          <Text
                            strong
                            style={{
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: item.isProcedure ? '#52c41a' : '#1677ff',
                            }}
                          >
                            {highlightMatch(item.code, query)}
                          </Text>
                          <Tag
                            color={SYSTEM_COLORS[item.codeSystem] || 'default'}
                            style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
                          >
                            {item.codeSystem}
                          </Tag>
                          {item.isBillable && (
                            <Tag
                              color="green"
                              style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
                            >
                              Billable
                            </Tag>
                          )}
                          {item.isProcedure && (
                            <Tag
                              color="green"
                              style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
                            >
                              Procedure
                            </Tag>
                          )}
                        </Space>
                        <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
                          {highlightMatch(item.description, query)}
                        </Text>
                        {item.category && (
                          <Text style={{ fontSize: 11, color: '#bfbfbf' }}>{item.category}</Text>
                        )}
                      </Space>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CodeSearchInput;
