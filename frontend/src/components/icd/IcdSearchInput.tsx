import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Input, Typography, Space, Spin, Tag, Empty, Button, Tooltip } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  GlobalOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  StarOutlined,
  StarFilled,
  HistoryOutlined,
  HeartOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { icdService, type IcdCode, type PatientProblem, type FavoriteDiagnosis, type RecentDiagnosis } from '../../services/icdService';
import { aiService, type DiagnosisSuggestion } from '../../services/aiService';

const { Text } = Typography;

type SearchItem =
  | { type: 'problem'; data: PatientProblem }
  | { type: 'favorite'; data: FavoriteDiagnosis }
  | { type: 'icd'; data: IcdCode }
  | { type: 'recent'; data: RecentDiagnosis }
  | { type: 'ai'; data: DiagnosisSuggestion };

interface IcdSearchInputProps {
  value?: string;
  description?: string;
  onSelect: (selection: { code: string; description: string; codeSystem?: string; problemListId?: string; isBillable?: boolean }) => void;
  placeholder?: string;
  autoFocus?: boolean;
  patientId?: string;
  providerId?: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <span key={i} style={{ background: '#fff7b0', fontWeight: 600, borderRadius: 2, padding: '0 1px' }}>{part}</span>
          : part,
      )}
    </>
  );
}

function isNaturalLanguageQuery(q: string): boolean {
  const trimmed = q.trim();
  if (!trimmed) return false;
  if (/^[A-Za-z]\d/.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[A-Za-z]\d*\.?\d*$/.test(trimmed)) return false;
  return trimmed.length > 3;
}

function groupHeader(label: string, icon: React.ReactNode, count: number): React.ReactNode {
  return (
    <div style={{ padding: '6px 12px', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', borderTop: '1px solid #e8e8e8' }}>
      <Space size={4}>
        {icon}
        <Text style={{ fontSize: 12, color: '#595959', fontWeight: 600 }}>{label}</Text>
        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>({count})</Text>
      </Space>
    </div>
  );
}

const IcdSearchInput: React.FC<IcdSearchInputProps> = ({
  value = '',
  description: desc = '',
  onSelect,
  placeholder = 'Search ICD-10 code, problem, or diagnosis description',
  autoFocus = false,
  patientId,
  providerId,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || desc || '');
  const [icdResults, setIcdResults] = useState<IcdCode[]>([]);
  const [patientProblems, setPatientProblems] = useState<PatientProblem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteDiagnosis[]>([]);
  const [recentDiagnoses, setRecentDiagnoses] = useState<RecentDiagnosis[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<DiagnosisSuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasUnifiedSearch = Boolean(patientId);

  const performSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim()) {
      setIcdResults([]);
      setPatientProblems([]);
      setFavorites([]);
      setRecentDiagnoses([]);
      setNoResults(false);
      setAiSuggestions(null);
      setShowAi(false);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setNoResults(false);
    setAiSuggestions(null);
    setShowAi(false);
    try {
      if (hasUnifiedSearch) {
        const res = await icdService.unifiedSearch(q, patientId, providerId, 25);
        if (controller.signal.aborted) return;
        setPatientProblems(res.patientActiveProblems);
        setFavorites(res.favoriteDiagnoses);
        setIcdResults(res.icd10Results);
        setRecentDiagnoses(res.recentDiagnoses);
        setFavoriteIds(new Set(res.favoriteDiagnoses.map((f) => `${f.code}|${f.description}`)));
        const empty =
          res.patientActiveProblems.length === 0 &&
          res.favoriteDiagnoses.length === 0 &&
          res.icd10Results.length === 0 &&
          res.recentDiagnoses.length === 0;
        setNoResults(empty);
        setOpen(true);
      } else {
        const res = await icdService.search(q, 25, 0);
        if (controller.signal.aborted) return;
        setIcdResults(res.data);
        const empty = res.data.length === 0;
        setNoResults(empty);
        setOpen(true);
        if (empty && isNaturalLanguageQuery(q)) {
          setShowAi(true);
        }
      }
      setSelectedIndex(-1);
    } catch {
      if (!controller.signal.aborted) {
        setIcdResults([]);
        setPatientProblems([]);
        setFavorites([]);
        setRecentDiagnoses([]);
        setNoResults(true);
        if (!hasUnifiedSearch && isNaturalLanguageQuery(q)) setShowAi(true);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [hasUnifiedSearch, patientId, providerId]);

  const debouncedSearch = useCallback((q: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => performSearch(q), 150);
  }, [performSearch]);

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

  const handleSelect = (item: SearchItem) => {
    let code: string;
    let description: string;
    let codeSystem: string | undefined;
    let problemListId: string | undefined;
    let isBillable: boolean | undefined;

    if (item.type === 'problem') {
      code = item.data.code;
      description = item.data.description;
      codeSystem = item.data.codeSystem;
      problemListId = item.data.id;
      isBillable = item.data.codeSystem === 'ICD-10-CM';
    } else if (item.type === 'favorite') {
      code = item.data.code;
      description = item.data.description;
      codeSystem = item.data.codeSystem;
      isBillable = item.data.isBillable;
    } else if (item.type === 'icd') {
      code = item.data.code;
      description = item.data.description;
      codeSystem = 'ICD-10-CM';
      isBillable = item.data.isBillable;
    } else if (item.type === 'recent') {
      code = item.data.code;
      description = item.data.description;
      codeSystem = item.data.codeSystem;
      isBillable = item.data.codeSystem === 'ICD-10-CM';
    } else {
      code = item.data.code;
      description = item.data.description;
      isBillable = false;
    }

    setQuery(`${code} - ${description}`);
    onSelect({ code, description, codeSystem, problemListId, isBillable });
    setOpen(false);
    setIcdResults([]);
    setPatientProblems([]);
    setFavorites([]);
    setRecentDiagnoses([]);
    setNoResults(false);
    setAiSuggestions(null);
    setShowAi(false);
  };

  const handleAiSelect = (suggestion: DiagnosisSuggestion) => {
    setQuery(`${suggestion.code} - ${suggestion.description}`);
    onSelect({
      code: suggestion.code,
      description: suggestion.description,
      codeSystem: 'ICD-10-CM',
      isBillable: false,
    });
    setOpen(false);
    setIcdResults([]);
    setPatientProblems([]);
    setFavorites([]);
    setRecentDiagnoses([]);
    setNoResults(false);
    setAiSuggestions(null);
    setShowAi(false);
  };

  const handleAiSearch = async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const res = await aiService.suggestDiagnosis({ query: query.trim(), limit: 8 });
      setAiSuggestions(res.data.suggestions ?? []);
    } catch {
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, item: { code: string; description: string; codeSystem?: string; isBillable?: boolean }) => {
    e.stopPropagation();
    const key = `${item.code}|${item.description}`;
    const existing = favorites.find((f) => `${f.code}|${f.description}` === key);
    if (existing) {
      try {
        await icdService.removeFavorite(existing.id);
        setFavorites(favorites.filter((f) => f.id !== existing.id));
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } catch {
        // ignore
      }
    } else {
      try {
        const created = await icdService.createFavorite({
          code: item.code,
          description: item.description,
          codeSystem: item.codeSystem || 'ICD-10-CM',
          isBillable: item.isBillable,
        });
        setFavorites([created, ...favorites]);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      } catch {
        // ignore
      }
    }
  };

  const allItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    patientProblems.forEach((p) => items.push({ type: 'problem', data: p }));
    favorites.forEach((f) => items.push({ type: 'favorite', data: f }));
    icdResults.forEach((r) => items.push({ type: 'icd', data: r }));
    recentDiagnoses.forEach((r) => items.push({ type: 'recent', data: r }));
    (aiSuggestions ?? []).forEach((s) => items.push({ type: 'ai', data: s }));
    return items;
  }, [patientProblems, favorites, icdResults, recentDiagnoses, aiSuggestions]);

  const totalCount = allItems.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || totalCount === 0) {
      if (e.key === 'Enter') {
        setOpen(false);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalCount - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalCount - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < totalCount) {
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
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-index]');
      const el = items[selectedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

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
    if (allItems.length > 0 || noResults || aiSuggestions) setOpen(true);
  };

  const handleExternalSearch = () => {
    window.open(`https://www.cms.gov/medicare/icd-10/2025-icd-10-cm`, '_blank');
  };

  const handleOfficialBrowser = () => {
    const searchTerm = query.trim();
    window.open(
      searchTerm
        ? `https://icd10cmtool.cms.gov/?search=${encodeURIComponent(searchTerm)}`
        : 'https://icd10cmtool.cms.gov/',
      '_blank',
    );
  };

  const hasIcdResults = icdResults.length > 0;
  const hasAiResults = aiSuggestions && aiSuggestions.length > 0;

  const renderProblem = (item: PatientProblem, idx: number) => {
    const isSelected = idx === selectedIndex;
    return (
      <div
        key={`problem-${item.id}`}
        data-index={idx}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          background: isSelected ? '#e6f7ff' : undefined,
          borderBottom: '1px solid #f0f0f0',
        }}
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => handleSelect({ type: 'problem', data: item })}
      >
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#1677ff' }}>
              {highlightMatch(item.code, query)}
            </Text>
            <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Problem</Tag>
            {item.isChronic && <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Chronic</Tag>}
          </Space>
          <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
            {highlightMatch(item.description, query)}
          </Text>
        </Space>
      </div>
    );
  };

  const renderFavorite = (item: FavoriteDiagnosis, idx: number) => {
    const isSelected = idx === selectedIndex;
    return (
      <div
        key={`favorite-${item.id}`}
        data-index={idx}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          background: isSelected ? '#e6f7ff' : undefined,
          borderBottom: '1px solid #f0f0f0',
        }}
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => handleSelect({ type: 'favorite', data: item })}
      >
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#1677ff' }}>
              {highlightMatch(item.code, query)}
            </Text>
            <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Favorite</Tag>
            {item.isBillable && (
              <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Billable</Tag>
            )}
          </Space>
          <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
            {highlightMatch(item.description, query)}
          </Text>
        </Space>
      </div>
    );
  };

  const renderIcd = (item: IcdCode, idx: number) => {
    const isSelected = idx === selectedIndex;
    const key = `${item.code}|${item.description}`;
    const isFavorite = favoriteIds.has(key);
    return (
      <div
        key={`icd-${item.id}`}
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
        onClick={() => handleSelect({ type: 'icd', data: item })}
      >
        <Space direction="vertical" size={0} style={{ flex: 1 }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#1677ff' }}>
              {highlightMatch(item.code, query)}
            </Text>
            {item.isBillable && (
              <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                Billable
              </Tag>
            )}
            {item.category && (
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{item.category}</Text>
            )}
          </Space>
          <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
            {highlightMatch(item.description, query)}
          </Text>
          {item.chapterTitle && (
            <Text style={{ fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>
              Ch. {item.chapter}: {item.chapterTitle}
            </Text>
          )}
        </Space>
        <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <span
            style={{ marginLeft: 8, color: isFavorite ? '#faad14' : '#bfbfbf', fontSize: 16 }}
            onClick={(e) => toggleFavorite(e, { code: item.code, description: item.description, codeSystem: 'ICD-10-CM', isBillable: item.isBillable })}
          >
            {isFavorite ? <StarFilled /> : <StarOutlined />}
          </span>
        </Tooltip>
      </div>
    );
  };

  const renderRecent = (item: RecentDiagnosis, idx: number) => {
    const isSelected = idx === selectedIndex;
    return (
      <div
        key={`recent-${item.code}-${idx}`}
        data-index={idx}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          background: isSelected ? '#e6f7ff' : undefined,
          borderBottom: '1px solid #f0f0f0',
        }}
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => handleSelect({ type: 'recent', data: item })}
      >
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#1677ff' }}>
              {highlightMatch(item.code, query)}
            </Text>
            <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Recent</Tag>
          </Space>
          <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
            {highlightMatch(item.description, query)}
          </Text>
        </Space>
      </div>
    );
  };

  const renderAi = (suggestion: DiagnosisSuggestion, idx: number) => {
    const isSelected = idx === selectedIndex;
    return (
      <div
        key={`ai-${suggestion.code}-${idx}`}
        data-index={idx}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          background: isSelected ? '#e6f7ff' : undefined,
          borderBottom: '1px solid #f0f0f0',
        }}
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => handleAiSelect(suggestion)}
      >
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#722ed1' }}>
              {suggestion.code}
            </Text>
            <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>AI</Tag>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
              {(suggestion.confidence * 100).toFixed(0)}% confidence
            </Text>
          </Space>
          <Text style={{ fontSize: 13, color: '#434343', lineHeight: 1.4 }}>
            {suggestion.description}
          </Text>
          {suggestion.rationale && (
            <Text style={{ fontSize: 11, color: '#8c8c8c', fontStyle: 'italic', marginTop: 2 }}>
              {suggestion.rationale}
            </Text>
          )}
        </Space>
      </div>
    );
  };

  let currentIndex = 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        autoFocus={autoFocus}
        prefix={loading ? <Spin size="small" /> : <SearchOutlined style={{ color: '#bfbfbf' }} />}
        suffix={
          query ? (
            <Text
              style={{ color: '#bfbfbf', cursor: 'pointer', fontSize: 12 }}
              onClick={() => { setQuery(''); setIcdResults([]); setPatientProblems([]); setFavorites([]); setRecentDiagnoses([]); setNoResults(false); setAiSuggestions(null); setShowAi(false); setOpen(false); }}
            >
              ✕
            </Text>
          ) : undefined
        }
        style={{ textTransform: 'uppercase' }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            marginTop: 4,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            border: '1px solid #e8e8e8',
            maxHeight: 520,
            overflow: 'auto',
          }}
          ref={listRef}
        >
          {noResults && !aiLoading && !aiSuggestions && (
            <div style={{ padding: 16 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">No matching diagnosis found.</Text>}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {showAi && (
                    <Button type="primary" size="small" icon={<ThunderboltOutlined />} block onClick={handleAiSearch} loading={aiLoading}>
                      Suggest with AI
                    </Button>
                  )}
                  <Button type="default" size="small" icon={<FileSearchOutlined />} block onClick={handleOfficialBrowser}>
                    Search Official ICD-10 Browser
                  </Button>
                  <Button type="default" size="small" icon={<RobotOutlined />} block onClick={handleAiSearch}>
                    Search AI Diagnosis Assistant
                  </Button>
                  <Button type="default" size="small" icon={<GlobalOutlined />} block onClick={handleExternalSearch}>
                    Search External Sources
                  </Button>
                </Space>
              </Empty>
            </div>
          )}

          {aiLoading && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spin />
              <div style={{ marginTop: 8 }}><Text type="secondary">AI is analyzing your query...</Text></div>
            </div>
          )}

          {patientProblems.length > 0 && (
            <>
              {groupHeader('Patient Active Problems', <HeartOutlined style={{ color: '#1677ff', fontSize: 13 }} />, patientProblems.length)}
              {patientProblems.map((p) => {
                const idx = currentIndex++;
                return renderProblem(p, idx);
              })}
            </>
          )}

          {favorites.length > 0 && (
            <>
              {groupHeader('Favorite Diagnoses', <StarFilled style={{ color: '#faad14', fontSize: 13 }} />, favorites.length)}
              {favorites.map((f) => {
                const idx = currentIndex++;
                return renderFavorite(f, idx);
              })}
            </>
          )}

          {hasIcdResults && (
            <>
              {groupHeader('ICD-10 Results', <FileTextOutlined style={{ color: '#1677ff', fontSize: 13 }} />, icdResults.length)}
              {icdResults.map((item) => {
                const idx = currentIndex++;
                return renderIcd(item, idx);
              })}
            </>
          )}

          {recentDiagnoses.length > 0 && (
            <>
              {groupHeader('Recent Diagnoses', <HistoryOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />, recentDiagnoses.length)}
              {recentDiagnoses.map((r) => {
                const idx = currentIndex++;
                return renderRecent(r, idx);
              })}
            </>
          )}

          {hasAiResults && (
            <>
              {groupHeader('AI Suggestions', <RobotOutlined style={{ color: '#1677ff', fontSize: 13 }} />, aiSuggestions!.length)}
              {aiSuggestions!.map((s) => {
                const idx = currentIndex++;
                return renderAi(s, idx);
              })}
            </>
          )}

          {!hasIcdResults && patientProblems.length === 0 && favorites.length === 0 && recentDiagnoses.length === 0 && !hasAiResults && !aiLoading && !noResults && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Text type="secondary">Type to search diagnoses...</Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IcdSearchInput;
