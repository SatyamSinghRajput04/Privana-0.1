import React from 'react';

interface ColumnMeta {
  name: string;
  type: string;
  is_he?: boolean;
}

interface DatasetProfilePanelProps {
  selectedDataset: any;
  columnsList: ColumnMeta[];
  fieldsSearch: string;
  setFieldsSearch: (val: string) => void;
}

export default function DatasetProfilePanel({
  selectedDataset,
  columnsList,
  fieldsSearch,
  setFieldsSearch
}: DatasetProfilePanelProps) {
  const filteredColumns = columnsList.filter(col => 
    col.name.toLowerCase().includes(fieldsSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Input Container */}
      <div style={{ padding: '0.45rem', borderBottom: '1px solid #1a1a24' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            style={{
              padding: '4px 8px',
              fontSize: '0.68rem',
              background: '#121215', 
              borderColor: '#3c1417',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '4px',
              width: '100%',
              color: '#fff',
              outline: 'none'
            }}
            placeholder="Search fields..."
            value={fieldsSearch}
            onChange={(e) => setFieldsSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Accordion List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.45rem' }}>
        {selectedDataset && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Accordion File Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              fontSize: '0.65rem', 
              color: '#e4e4e7', 
              fontWeight: 700, 
              padding: '0.35rem 0.45rem', 
              background: '#121214',
              borderRadius: '4px',
              marginBottom: '0.25rem',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}>
              <span>▼</span>
              <span>📄</span> 
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDataset.name}</span>
            </div>
            
            {/* Fields list */}
            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0.5rem' }}>
              {filteredColumns.map(col => {
                const isNum = col.type === 'number' || ['DECIMAL','INTEGER','BIGINT','FLOAT'].includes(col.type?.toUpperCase());
                return (
                  <div 
                    key={col.name} 
                    style={{ 
                      padding: '0.28rem 0.45rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      cursor: 'default',
                      borderRadius: '3px',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#121216'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ 
                      fontFamily: 'var(--mono)', 
                      fontSize: '0.54rem', 
                      color: isNum ? '#ef4444' : '#3b82f6', 
                      fontWeight: 800,
                      width: '18px',
                      display: 'inline-block'
                    }}>
                      {isNum ? '#' : 'Aa'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#a1a1aa' }}>{col.name}</span>
                    {isNum && (
                      <span style={{ marginLeft: 'auto', color: '#71717a', fontSize: '0.62rem', fontWeight: 600 }}>Σ</span>
                    )}
                    {col.is_he && (
                      <span style={{ marginLeft: isNum ? '0.2rem' : 'auto', color: '#c084fc', fontSize: '0.6rem' }} title="Homomorphically Encrypted">🔒</span>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* Visual Fields Builder Dropzone */}
      <div style={{ padding: '0.55rem', borderTop: '1px solid #1a1a24' }}>
        <div style={{
          border: '1.5px dashed #451a1d',
          borderRadius: '6px',
          padding: '0.85rem 0.55rem',
          textAlign: 'center',
          background: 'rgba(239,68,68,0.01)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          cursor: 'default'
        }}>
          <div style={{ fontSize: '1.25rem' }}>▰</div>
          <span style={{ fontSize: '0.65rem', color: '#71717a', lineHeight: 1.3 }}>
            Drag data fields here to build visuals
          </span>
        </div>
      </div>
    </div>
  );
}
