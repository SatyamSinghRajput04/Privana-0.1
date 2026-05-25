import { useState } from 'react';
import type { Page, Workspace } from '../App';
import { useVaultStore } from '../store/useVaultStore';
import { 
  Home, Sliders, BarChart2, LayoutGrid, Database, Clock, Settings, LogOut, Leaf, ChevronLeft, ChevronRight 
} from 'lucide-react';

interface P { 
  page: Page; 
  setPage: (p: Page) => void; 
  workspaces: Workspace[]; 
  ws: Workspace | null; 
  setWs: (w: Workspace) => void; 
  open: boolean; 
  netAlert: boolean; 
}

export default function Sidebar({ page, setPage, workspaces, ws, setWs, open, netAlert }: P) {
  const { logout } = useVaultStore();
  const [collapsed, setCollapsed] = useState(false);

  // Map app pages to sidebar items matching Image 3 labels
  const NAV_ITEMS = [
    { id: 'home' as Page, label: 'Home', icon: Home },
    { id: 'network' as Page, label: 'Measure', icon: Sliders },
    { id: 'analyze' as Page, label: 'Analyze', icon: BarChart2 },
    { id: 'saved' as Page, label: 'Report', icon: LayoutGrid },
    { id: 'datasets' as Page, label: 'Datasets', icon: Database },
    { id: 'history' as Page, label: 'History', icon: Clock },
  ];

  if (!open) return null;

  return (
    <div className="sidebar-floating-wrap" style={{ width: collapsed ? 84 : 274 }}>
      {/* PANEL 1: Left Narrow Icon Strip */}
      <div className="sidebar-icon-strip">
        {/* Logo leaf in a solid red circular badge */}
        <div className="sidebar-logo-item">
          <Leaf size={16} style={{ fill: '#fff', color: '#fff' }} />
        </div>

        {/* Navigation Icons */}
        <div className="sidebar-icons-list">
          {NAV_ITEMS.map((item) => {
            const isActive = page === item.id;
            const Icon = item.icon;
            return (
              <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <button
                  className={`sidebar-icon-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setPage(item.id)}
                  title={item.label}
                >
                  <Icon size={16} />
                </button>
                {/* Right pointing active pointer bubble */}
                {isActive && !collapsed && (
                  <div className="sidebar-active-pointer" />
                )}
              </div>
            );
          })}
        </div>

        {/* Settings at the bottom */}
        <div style={{ marginTop: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button
            className={`sidebar-icon-btn ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* PANEL 2: Right Wider Text Strip */}
      {!collapsed && (
        <div className="sidebar-text-pane">
          {/* Menu Labels */}
          <div className="sidebar-menu-list">
            {NAV_ITEMS.map((item) => {
              const isActive = page === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  <Icon size={14} style={{ opacity: isActive ? 1 : 0.6 }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '4px 8px' }} />
            
            <button
              className={`sidebar-menu-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => setPage('settings')}
            >
              <Settings size={14} style={{ opacity: page === 'settings' ? 1 : 0.6 }} />
              <span>Settings</span>
            </button>
          </div>

          {/* Bottom Card & Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            
            {/* Offline Telemetry Card */}
            <div className="sidebar-telemetry-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="sidebar-dot-red" />
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#f4f4f5' }}>0 bytes sent</span>
              </div>
              <div style={{ fontSize: '0.55rem', color: '#71717a', marginTop: '1px' }}>Fully offline</div>
            </div>

            {/* Exit Workspace */}
            <button 
              className="sidebar-menu-item"
              onClick={logout}
              style={{ color: '#ef4444' }}
            >
              <LogOut size={14} style={{ opacity: 0.7 }} />
              <span>Exit Workspace</span>
            </button>

            {/* Collapse Trigger */}
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft size={13} />
              <span>Collapse</span>
            </button>
          </div>
        </div>
      )}

      {/* Expand trigger floating badge when collapsed */}
      {collapsed && (
        <button 
          className="sidebar-expand-btn"
          onClick={() => setCollapsed(false)}
          title="Expand Menu"
        >
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}
