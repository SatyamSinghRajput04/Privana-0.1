import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import HomePage from './pages/HomePage';
import AnalyzePage from './pages/AnalyzePage';
import DatasetsPage from './pages/DatasetsPage';
import HistoryPage from './pages/HistoryPage';
import NetworkPage from './pages/NetworkPage';
import SavedPage from './pages/SavedPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import { useVaultStore } from './store/useVaultStore';
import { ErrorBoundary } from './components/ErrorBoundary';

export type Page = 'home' | 'analyze' | 'datasets' | 'history' | 'network' | 'saved' | 'settings';
export interface Workspace { 
  id: number; 
  name: string; 
  description: string; 
  mode: string; 
  owner: string; 
  created_at: string; 
}

const PAGE_LABELS: Record<Page, string> = { 
  home: 'Home', 
  analyze: 'Analyze', 
  datasets: 'Datasets', 
  history: 'History', 
  network: 'Network Monitor', 
  saved: 'Saved', 
  settings: 'Settings' 
};

export default function App() {
  const { 
    page, 
    ws, 
    workspaces, 
    netAlert, 
    isAuthenticated,
    setPage, 
    setWs, 
    setNetAlert, 
    loadWorkspaces, 
    checkOllama 
  } = useVaultStore();
  const [sideOpen, setSideOpen] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
      checkOllama();
    }
  }, [isAuthenticated, loadWorkspaces, checkOllama]);

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  const shared = { ws, workspaces, setWS: () => {}, setWs, setPage, onMenu: () => setSideOpen(o => !o) };

  return (
    <ErrorBoundary fallbackTitle="Privana Application Error">
    <div className="app">
      <Sidebar 
        page={page} 
        setPage={setPage} 
        open={sideOpen} 
      />
      <div className="main-area">
        {page !== 'analyze' && (
          <Topbar 
            page={page} 
            ws={ws} 
            label={PAGE_LABELS[page]} 
            onMenu={() => setSideOpen(o => !o)} 
            netAlert={netAlert} 
            onNet={() => setPage('network')} 
          />
        )}
        <div className="page-wrap" style={{ height: '100%' }}>
          <div style={{ display: page === 'home' ? 'block' : 'none' }}>
            <HomePage {...shared} />
          </div>
          <div style={{ 
            display: page === 'analyze' ? 'block' : 'none', 
            height: page === 'analyze' ? '100%' : 'auto' 
          }}>
            <ErrorBoundary fallbackTitle="Analyze Page Error">
              <AnalyzePage {...shared} page={page} />
            </ErrorBoundary>
          </div>
          <div style={{ display: page === 'datasets' ? 'block' : 'none' }}>
            <ErrorBoundary fallbackTitle="Datasets Page Error">
              <DatasetsPage {...shared} />
            </ErrorBoundary>
          </div>
          <div style={{ display: page === 'history' ? 'block' : 'none' }}>
            <HistoryPage {...shared} activePage={page} />
          </div>
          <div style={{ display: page === 'network' ? 'block' : 'none' }}>
            <NetworkPage ws={ws} onAlert={() => setNetAlert(true)} />
          </div>
          <div style={{ display: page === 'saved' ? 'block' : 'none' }}>
            <SavedPage ws={ws} activePage={page} />
          </div>
          <div style={{ display: page === 'settings' ? 'block' : 'none' }}>
            <SettingsPage />
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
