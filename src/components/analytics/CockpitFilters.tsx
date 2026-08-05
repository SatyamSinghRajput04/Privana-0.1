import React from 'react';
import { Search } from 'lucide-react';

interface CockpitFiltersProps {
  genderFilter: { male: boolean; female: boolean };
  setGenderFilter: React.Dispatch<React.SetStateAction<{ male: boolean; female: boolean }>>;
  platformFilter: Record<string, boolean>;
  setPlatformFilter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  ageRange: [number, number];
  setAgeRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  filterSearch: string;
  setFilterSearch: (val: string) => void;
  baselineCounts: { male: number; female: number; [key: string]: number };
  handleSelectAllGender: () => void;
  handleSelectAllPlatform: () => void;
}

export default function CockpitFilters({
  genderFilter,
  setGenderFilter,
  platformFilter,
  setPlatformFilter,
  ageRange,
  setAgeRange,
  filterSearch,
  setFilterSearch,
  baselineCounts,
  handleSelectAllGender,
  handleSelectAllPlatform
}: CockpitFiltersProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Clear filters row */}
      <div style={{
        padding: '0.55rem 0.85rem',
        borderBottom: '1px solid #1a1a24',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active filters</span>
        <button 
          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', padding: 0 }}
          onClick={() => {
            setGenderFilter({ male: true, female: true });
            setPlatformFilter({ Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true });
            setAgeRange([13, 19]);
          }}
        >
          Clear filters
        </button>
      </div>

      {/* Search filters */}
      <div style={{ padding: '0.55rem 0.85rem', borderBottom: '1px solid #1a1a24' }}>
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
            placeholder="Search filters..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        {/* Filter Section 1: Gender */}
        <div style={{ borderBottom: '1px solid #1a1a24', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
            <span>Gender</span>
            <span style={{ fontSize: '0.58rem', color: '#71717a' }}>is (All)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
              <input 
                type="checkbox" 
                style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                checked={genderFilter.male && genderFilter.female}
                onChange={handleSelectAllGender}
              />
              <span style={{ color: '#e4e4e7' }}>Select all</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
              <input 
                type="checkbox" 
                style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                checked={genderFilter.male} 
                onChange={() => setGenderFilter(prev => ({ ...prev, male: !prev.male }))}
              />
              <span style={{ color: '#e4e4e7' }}>male</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>{baselineCounts.male}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
              <input 
                type="checkbox" 
                style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                checked={genderFilter.female} 
                onChange={() => setGenderFilter(prev => ({ ...prev, female: !prev.female }))}
              />
              <span style={{ color: '#e4e4e7' }}>female</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>{baselineCounts.female}</span>
            </label>
          </div>
        </div>

        {/* Filter Section 2: Platform */}
        <div style={{ borderBottom: '1px solid #1a1a24', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
            <span>Platform</span>
            <span style={{ fontSize: '0.58rem', color: '#71717a' }}>is (All)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
              <input 
                type="checkbox" 
                style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                checked={Object.values(platformFilter).every(v => v)}
                onChange={handleSelectAllPlatform}
              />
              <span style={{ color: '#e4e4e7' }}>Select all</span>
            </label>
            {Object.keys(platformFilter).map((plat) => (
              <label key={plat} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                <input 
                  type="checkbox" 
                  style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                  checked={platformFilter[plat]} 
                  onChange={() => setPlatformFilter(prev => ({ ...prev, [plat]: !prev[plat] }))}
                />
                <span style={{ color: '#e4e4e7' }}>{plat}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>
                  {(baselineCounts as any)[plat] || 0}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Filter Section 3: Age Range */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
            <span>Age Range</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{ageRange[0]} - {ageRange[1]}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input 
                type="range" 
                min={13} 
                max={19} 
                value={ageRange[0]} 
                onChange={(e) => setAgeRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), ageRange[1])])}
                style={{ flex: 1, accentColor: '#ef4444', height: 3 }} 
              />
              <input 
                type="range" 
                min={13} 
                max={19} 
                value={ageRange[1]} 
                onChange={(e) => setAgeRange([Math.min(parseInt(e.target.value), ageRange[0]), parseInt(e.target.value)])}
                style={{ flex: 1, accentColor: '#ef4444', height: 3 }} 
              />
            </div>
            <button 
              style={{
                background: 'transparent',
                border: '1px solid #3c1417',
                color: '#ef4444',
                borderRadius: '4px',
                padding: '3px 0',
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '0.2rem',
                textAlign: 'center'
              }}
              onClick={() => alert('Filters restricted to age range ' + ageRange[0] + ' - ' + ageRange[1])}
            >
              Apply filter
            </button>
          </div>
        </div>

      </div>

      {/* Bottom indicator */}
      <div style={{ padding: '0.55rem 0.85rem', borderTop: '1px solid #1a1a24', display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#71717a' }}>
        <span>Filters on all pages</span>
        <span>▶</span>
      </div>
    </div>
  );
}
