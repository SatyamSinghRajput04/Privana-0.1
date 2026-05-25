import type { Page, Workspace } from '../App';

interface P { page:Page; ws:Workspace|null; label:string; onMenu:()=>void; netAlert:boolean; onNet:()=>void; }

export default function Topbar({ ws, label, onMenu, netAlert, onNet }:P) {
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
        <div className={`net-pill ${netAlert?'alert':''}`} onClick={onNet}>
          <div className={`net-dot ${netAlert?'alert':''}`} />
          {netAlert ? '⚠ ALERT' : '● 0 bytes'}
        </div>
        <button className="icon-btn">🔔</button>
        <button className="icon-btn">👤</button>
      </div>
    </div>
  );
}
