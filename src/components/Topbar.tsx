import type { Page, Workspace } from '../App';
import { useVaultStore } from '../store/useVaultStore';

interface P { page:Page; ws:Workspace|null; label:string; onMenu:()=>void; netAlert:boolean; onNet:()=>void; }

const formatBytes = (b: number) => {
  if (b === 0) return '0 bytes';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function Topbar({ ws, label, onMenu, netAlert, onNet }:P) {
  const egressStats = useVaultStore(state => state.egressStats);

  return (
    <div className="topbar">
      <button className="icon-btn" onClick={onMenu} title="Toggle sidebar">☰</button>
      <div className="tb-crumb">
        <span>Privana</span>
        {ws && <><span className="tb-sep">/</span><span>{ws.name}</span></>}
        <span className="tb-sep">/</span>
        <span className="tb-cur">{label}</span>
      </div>
      <div className="tb-right">
        <div className={`net-pill ${netAlert?'alert':''}`} onClick={onNet} title="External data egress">
          <div className={`net-dot ${netAlert?'alert':''}`} />
          {netAlert ? '⚠ ALERT' : `● ${formatBytes(egressStats.external)}`}
        </div>
        <button className="icon-btn">🔔</button>
        <button className="icon-btn">👤</button>
      </div>
    </div>
  );
}
