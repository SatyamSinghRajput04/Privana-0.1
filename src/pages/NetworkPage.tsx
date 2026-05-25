import { motion } from 'framer-motion';
import type { Workspace } from '../App';
import NetworkMonitor from '../components/NetworkMonitor';

interface P { ws:Workspace|null; onAlert:()=>void; }

const LAYERS = [
  {n:'01',t:'Visual Proof',       d:'Live counter of outbound bytes. Refreshes every 500ms. Anyone can see it.',              s:'Active · MVP',  c:'var(--blue3)'},
  {n:'02',t:'Signed Audit Log',   d:'Ed25519-signed Merkle chain. Every event cryptographically chained. Tamper-proof PDF.',  s:'Active · MVP',  c:'var(--blue2)'},
  {n:'03',t:'.pcap Export',       d:'Wireshark-compatible capture. Security teams can independently verify zero outbound.',    s:'V2 Roadmap',    c:'var(--blue4)'},
  {n:'04',t:'TEE Attestation',    d:'Hardware-signed proof from AMD SEV-SNP or Intel SGX. CPU certifies the monitor itself.', s:'V2/V3 Roadmap', c:'var(--red3)'},
];

export default function NetworkPage({ onAlert }:P) {
  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Privacy Verification</div>
            <h1 className="ph-title">Network Monitor</h1>
            <p className="ph-desc">Cryptographic proof that Privana never sends your data anywhere. Not a promise — a live, verifiable fact.</p>
          </div>
          <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
            <span className="tag tag-green">🔒 Hardware Isolated</span>
            <span className="tag tag-green">Ed25519 Signed</span>
          </div>
        </div>
      </div>

      <div className="pb">
        <NetworkMonitor onAlert={onAlert} />

        <div style={{marginTop:'1.5rem'}}>
          <div className="sec-row"><div className="sec-title">🔏 Four Layers of Verifiable Trust</div></div>
          <div className="ga">
            {LAYERS.map((l,i)=>(
              <motion.div key={i} className="card card-hover" style={{borderColor:l.c+'44'}} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}>
                <div style={{fontFamily:'var(--mono)',fontSize:'1.6rem',fontWeight:900,color:l.c,opacity:0.18,lineHeight:1,marginBottom:'0.4rem'}}>{l.n}</div>
                <div className="card-title">{l.t}</div>
                <div className="card-desc" style={{marginBottom:'0.65rem'}}>{l.d}</div>
                <span className={`tag ${l.s.includes('MVP')?'tag-green':'tag-amber'}`}>{l.s}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div style={{marginTop:'1.25rem'}} className="card" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4}}>
          <div className="eyebrow" style={{marginBottom:'0.65rem'}}>How It Works</div>
          <div className="code-block">{`Network Interface (OS kernel)
         │
         ▼  scapy / pyshark (raw packet capture)
Capture Thread (asyncio, separate process)
         │
         ▼  PID → process name mapping (/proc/net/tcp)
Classifier: PRIVANA_OUTBOUND | SYSTEM_* | LOCALHOST
         │
         ├──► Audit Logger (SQLite + Merkle chain + Ed25519)
         ├──► Metrics Aggregator (bytes, connections, uptime)
         └──► WebSocket → React UI (real-time, no polling)

At session end:
  Audit Log ──► PDF Report (HIPAA / GDPR / SOC 2 templates)
             ──► .pcap export (Wireshark-compatible)`}</div>
        </motion.div>
      </div>
    </div>
  );
}
