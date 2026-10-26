import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, ChevronDown, ChevronRight, Filter } from 'lucide-react';

export interface FilterClause {
  column: string;
  operator: 'eq' | 'in' | 'between' | 'gt' | 'lt' | 'is_null';
  value: any;
  includeNull?: boolean;
}

export interface FilterColumnMeta {
  name: string;
  type: string;
  uniqueValues?: any[];
  min?: number;
  max?: number;
  distribution?: { value: string; count: number }[];
  nullPct?: number;
}

export interface ActiveCockpitFiltersProps {
  columns: FilterColumnMeta[];
  activeFilters: Record<string, FilterClause>;
  onFilterChange: (column: string, clause: FilterClause | null) => void;
  onClearAllFilters: () => void;
}

export function isIdentifierColumn(colName: string, colType?: string, colRole?: string): boolean {
  if (colType === 'identifier' || colType === 'id' || colRole === 'id') return true;
  const lower = (colName || '').toLowerCase();
  return (
    lower.endsWith('_id') ||
    lower.endsWith('_uuid') ||
    lower.endsWith('_key') ||
    lower === 'id' ||
    lower === 'uuid' ||
    lower.includes('guid') ||
    lower.endsWith('_hash')
  );
}

export function compileFilterClausesToSQL(clauses: FilterClause[]): { sql: string; params: any[] } {
  if (!clauses || clauses.length === 0) {
    return { sql: '', params: [] };
  }
  const parts: string[] = [];
  const params: any[] = [];

  for (const clause of clauses) {
    const colQuoted = `"${clause.column.replace(/"/g, '""')}"`;
    let condition = '';

    switch (clause.operator) {
      case 'eq':
        condition = `${colQuoted} = ?`;
        params.push(clause.value);
        break;
      case 'in':
        if (Array.isArray(clause.value) && clause.value.length > 0) {
          const placeholders = clause.value.map(() => '?').join(', ');
          condition = `${colQuoted} IN (${placeholders})`;
          params.push(...clause.value);
        } else {
          condition = '1=0';
        }
        break;
      case 'between':
        condition = `${colQuoted} BETWEEN ? AND ?`;
        params.push(clause.value[0], clause.value[1]);
        break;
      case 'gt':
        condition = `${colQuoted} > ?`;
        params.push(clause.value);
        break;
      case 'lt':
        condition = `${colQuoted} < ?`;
        params.push(clause.value);
        break;
      case 'is_null':
        condition = `${colQuoted} IS NULL`;
        break;
    }

    if (clause.includeNull) {
      parts.push(`(${condition} OR ${colQuoted} IS NULL)`);
    } else {
      parts.push(`(${condition} AND ${colQuoted} IS NOT NULL)`);
    }
  }

  return {
    sql: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
    params
  };
}

export default function ActiveCockpitFilters({
  columns,
  activeFilters,
  onFilterChange,
  onClearAllFilters
}: ActiveCockpitFiltersProps) {
  const [filterSearch, setFilterSearch] = useState('');
  const [categorySearchTerms, setCategorySearchTerms] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Filter out identifier columns and apply column name search
  const filterableColumns = useMemo(() => {
    return (columns || []).filter(col => {
      if (isIdentifierColumn(col.name, col.type, (col as any).role)) return false;
      if (filterSearch.trim()) {
        return col.name.toLowerCase().includes(filterSearch.toLowerCase());
      }
      return true;
    });
  }, [columns, filterSearch]);

  const activeFilterCount = Object.keys(activeFilters).length;

  const toggleSection = (colName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [colName]: prev[colName] === undefined ? false : !prev[colName]
    }));
  };

  const handleCategorySearchChange = (colName: string, val: string) => {
    setCategorySearchTerms(prev => ({ ...prev, [colName]: val }));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header: Active filters & Clear all */}
      <div style={{
        padding: '0.55rem 0.85rem',
        borderBottom: '1px solid #1a1a24',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#09090b',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={12} style={{ color: '#ef4444' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Slicers {activeFilterCount > 0 && `(${activeFilterCount})`}
          </span>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearAllFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '0.6rem',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              borderRadius: '4px'
            }}
            title="Reset all slicers"
          >
            <RotateCcw size={10} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Filter Slicer Search */}
      <div style={{ padding: '0.55rem 0.85rem', borderBottom: '1px solid #1a1a24', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 8, top: 7.5, color: '#52525b' }} />
          <input
            type="text"
            style={{
              height: 25,
              fontSize: '0.65rem',
              paddingLeft: '1.5rem',
              background: '#121215',
              borderColor: '#3c1417',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '4px',
              width: '100%',
              color: '#fff',
              outline: 'none'
            }}
            placeholder="Search column slicers..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable Column Slicers Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filterableColumns.length === 0 ? (
          <div style={{ fontSize: '0.65rem', color: '#71717a', textAlign: 'center', padding: '1.5rem 0' }}>
            No slicers found
          </div>
        ) : (
          filterableColumns.map(col => {
            const isNumeric = col.type === 'number' || col.type === 'numeric' || ['INTEGER', 'DECIMAL', 'BIGINT', 'FLOAT'].includes(col.type?.toUpperCase());
            const isDate = col.type === 'date' || col.type === 'timestamp';
            const isExpanded = expandedSections[col.name] !== false; // expanded by default
            const currentClause = activeFilters[col.name];

            return (
              <div
                key={col.name}
                style={{
                  borderBottom: '1px solid #1a1a24',
                  paddingBottom: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                {/* Section Header */}
                <div
                  onClick={() => toggleSection(col.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isExpanded ? <ChevronDown size={12} style={{ color: '#a1a1aa' }} /> : <ChevronRight size={12} style={{ color: '#a1a1aa' }} />}
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: currentClause ? '#ef4444' : '#e4e4e7' }}>
                      {col.name}
                    </span>
                    <span style={{
                      fontSize: '0.52rem',
                      fontFamily: 'var(--mono)',
                      color: isNumeric ? '#f97316' : isDate ? '#10b981' : '#3b82f6',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '1px 4px',
                      borderRadius: '3px'
                    }}>
                      {isNumeric ? '123' : isDate ? 'date' : 'abc'}
                    </span>
                  </div>

                  {currentClause && (
                    <span style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}>
                    {/* Missing / Null toggle (Option A) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.62rem', color: '#a1a1aa' }}>
                      <input
                        type="checkbox"
                        checked={!!currentClause?.includeNull}
                        onChange={(e) => {
                          if (currentClause) {
                            onFilterChange(col.name, {
                              ...currentClause,
                              includeNull: e.target.checked
                            });
                          } else {
                            onFilterChange(col.name, {
                              column: col.name,
                              operator: isNumeric ? 'between' : 'in',
                              value: isNumeric ? [col.min ?? 0, col.max ?? 100] : [],
                              includeNull: e.target.checked
                            });
                          }
                        }}
                        style={{ accentColor: '#ef4444', width: 11, height: 11 }}
                      />
                      <span>Include (Missing / Null)</span>
                    </label>

                    {/* Numeric Slicer: Dual-range continuous slider / inputs */}
                    {isNumeric && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: '#71717a' }}>
                          <span>Min: {col.min ?? 0}</span>
                          <span>Max: {col.max ?? 100}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="Min"
                            value={currentClause?.operator === 'between' ? currentClause.value[0] : (col.min ?? '')}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              const currentMax = currentClause?.operator === 'between' ? currentClause.value[1] : (col.max ?? 100);
                              if (isNaN(val)) {
                                onFilterChange(col.name, null);
                              } else {
                                onFilterChange(col.name, {
                                  column: col.name,
                                  operator: 'between',
                                  value: [val, currentMax],
                                  includeNull: currentClause?.includeNull
                                });
                              }
                            }}
                            style={{
                              width: '48%',
                              height: 22,
                              fontSize: '0.62rem',
                              background: '#121215',
                              border: '1px solid #3c1417',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                          <span style={{ color: '#71717a', fontSize: '0.6rem' }}>to</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={currentClause?.operator === 'between' ? currentClause.value[1] : (col.max ?? '')}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              const currentMin = currentClause?.operator === 'between' ? currentClause.value[0] : (col.min ?? 0);
                              if (isNaN(val)) {
                                onFilterChange(col.name, null);
                              } else {
                                onFilterChange(col.name, {
                                  column: col.name,
                                  operator: 'between',
                                  value: [currentMin, val],
                                  includeNull: currentClause?.includeNull
                                });
                              }
                            }}
                            style={{
                              width: '48%',
                              height: 22,
                              fontSize: '0.62rem',
                              background: '#121215',
                              border: '1px solid #3c1417',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Date Slicer: Dual date picker */}
                    {isDate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="date"
                            value={currentClause?.operator === 'between' ? currentClause.value[0] : ''}
                            onChange={(e) => {
                              const start = e.target.value;
                              const currentEnd = currentClause?.operator === 'between' ? currentClause.value[1] : '';
                              if (!start && !currentEnd) {
                                onFilterChange(col.name, null);
                              } else {
                                onFilterChange(col.name, {
                                  column: col.name,
                                  operator: 'between',
                                  value: [start, currentEnd],
                                  includeNull: currentClause?.includeNull
                                });
                              }
                            }}
                            style={{
                              width: '48%',
                              height: 22,
                              fontSize: '0.6rem',
                              background: '#121215',
                              border: '1px solid #3c1417',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                          <span style={{ color: '#71717a', fontSize: '0.6rem' }}>to</span>
                          <input
                            type="date"
                            value={currentClause?.operator === 'between' ? currentClause.value[1] : ''}
                            onChange={(e) => {
                              const end = e.target.value;
                              const currentStart = currentClause?.operator === 'between' ? currentClause.value[0] : '';
                              if (!currentStart && !end) {
                                onFilterChange(col.name, null);
                              } else {
                                onFilterChange(col.name, {
                                  column: col.name,
                                  operator: 'between',
                                  value: [currentStart, end],
                                  includeNull: currentClause?.includeNull
                                });
                              }
                            }}
                            style={{
                              width: '48%',
                              height: 22,
                              fontSize: '0.6rem',
                              background: '#121215',
                              border: '1px solid #3c1417',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Categorical Slicer: Low-Cardinality vs High-Cardinality Option A */}
                    {!isNumeric && !isDate && (
                      <CategoricalSlicer
                        column={col}
                        currentClause={currentClause}
                        searchTerm={categorySearchTerms[col.name] || ''}
                        onSearchChange={(val) => handleCategorySearchChange(col.name, val)}
                        onFilterChange={(clause) => onFilterChange(col.name, clause)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Categorical Slicer (Option A Top 10 + Debounced Search)
// ─────────────────────────────────────────────────────────────────────────────
interface CategoricalSlicerProps {
  column: FilterColumnMeta;
  currentClause: FilterClause | undefined;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onFilterChange: (clause: FilterClause | null) => void;
}

function CategoricalSlicer({
  column,
  currentClause,
  searchTerm,
  onSearchChange,
  onFilterChange
}: CategoricalSlicerProps) {
  // Derive category items: if distribution is provided, use it; otherwise uniqueValues
  const allCategories = useMemo(() => {
    if (column.distribution && column.distribution.length > 0) {
      return column.distribution;
    }
    const uniques = column.uniqueValues || [];
    return uniques.map(u => ({ value: String(u), count: 0 }));
  }, [column]);

  const cardinality = allCategories.length;
  const isHighCardinality = cardinality > 15;

  // Selected values array
  const selectedValues: string[] = useMemo(() => {
    if (!currentClause) return [];
    if (currentClause.operator === 'eq') return [String(currentClause.value)];
    if (currentClause.operator === 'in' && Array.isArray(currentClause.value)) {
      return currentClause.value.map(String);
    }
    return [];
  }, [currentClause]);

  // Option A: Top 10 most frequent categories + search filter
  const displayedCategories = useMemo(() => {
    let list = allCategories;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = allCategories.filter(c => c.value.toLowerCase().includes(q));
    } else if (isHighCardinality) {
      // Show top 10
      list = allCategories.slice(0, 10);
    }
    return list;
  }, [allCategories, searchTerm, isHighCardinality]);

  const handleToggleCategory = (val: string) => {
    const isSelected = selectedValues.includes(val);
    let nextSelected: string[];
    if (isSelected) {
      nextSelected = selectedValues.filter(v => v !== val);
    } else {
      nextSelected = [...selectedValues, val];
    }

    if (nextSelected.length === 0) {
      if (currentClause?.includeNull) {
        onFilterChange({
          column: column.name,
          operator: 'is_null',
          value: null,
          includeNull: true
        });
      } else {
        onFilterChange(null);
      }
    } else if (nextSelected.length === 1) {
      onFilterChange({
        column: column.name,
        operator: 'eq',
        value: nextSelected[0],
        includeNull: currentClause?.includeNull
      });
    } else {
      onFilterChange({
        column: column.name,
        operator: 'in',
        value: nextSelected,
        includeNull: currentClause?.includeNull
      });
    }
  };

  const handleSelectAll = () => {
    const allVals = allCategories.map(c => c.value);
    const areAllSelected = allVals.length > 0 && allVals.every(v => selectedValues.includes(v));
    if (areAllSelected) {
      onFilterChange(null);
    } else {
      onFilterChange({
        column: column.name,
        operator: 'in',
        value: allVals,
        includeNull: currentClause?.includeNull
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {/* Option A: Search input for medium/high cardinality */}
      {isHighCardinality && (
        <div style={{ position: 'relative', marginBottom: '0.2rem' }}>
          <input
            type="text"
            placeholder={`Search ${cardinality} categories...`}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              height: 22,
              fontSize: '0.6rem',
              padding: '2px 6px',
              background: '#121215',
              border: '1px solid #27272a',
              borderRadius: '3px',
              width: '100%',
              color: '#fff',
              outline: 'none'
            }}
          />
        </div>
      )}

      {/* Select All Toggle for low cardinality */}
      {!isHighCardinality && allCategories.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.62rem', color: '#e4e4e7' }}>
          <input
            type="checkbox"
            checked={allCategories.length > 0 && allCategories.every(c => selectedValues.includes(c.value))}
            onChange={handleSelectAll}
            style={{ accentColor: '#ef4444', width: 11, height: 11 }}
          />
          <span style={{ fontWeight: 600 }}>Select all ({allCategories.length})</span>
        </label>
      )}

      {/* Category Pills / Checkbox list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '180px', overflowY: 'auto' }}>
        {displayedCategories.map(cat => {
          const isChecked = selectedValues.includes(cat.value);
          return (
            <label
              key={cat.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontSize: '0.62rem',
                padding: '2px 4px',
                borderRadius: '3px',
                background: isChecked ? 'rgba(239, 68, 68, 0.08)' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleCategory(cat.value)}
                  style={{ accentColor: '#ef4444', width: 11, height: 11 }}
                />
                <span style={{
                  color: isChecked ? '#fff' : '#a1a1aa',
                  fontWeight: isChecked ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {cat.value}
                </span>
              </div>
              {cat.count > 0 && (
                <span style={{ fontSize: '0.55rem', fontFamily: 'var(--mono)', color: '#71717a' }}>
                  {cat.count}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {isHighCardinality && !searchTerm && (
        <span style={{ fontSize: '0.52rem', color: '#71717a', fontStyle: 'italic', marginTop: '0.1rem' }}>
          Showing top 10 of {cardinality} categories. Use search for others.
        </span>
      )}
    </div>
  );
}
