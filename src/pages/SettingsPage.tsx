import { useState } from 'react';
import { motion } from 'framer-motion';
import OllamaDiagnostics from '../components/OllamaDiagnostics';

const MODELS = [
  {id:'codellama:7b',  label:'CodeLlama 7B',   ram:'5 GB', speed:'Fast',    best:'SQL generation ★'},
  {id:'llama3.1:8b',   label:'Llama 3.1 8B',   ram:'6 GB', speed:'Fast',    best:'General analysis'},
  {id:'mistral:7b',    label:'Mistral 7B',      ram:'5 GB', speed:'Fast',    best:'Balanced'},
  {id:'phi3:mini',     label:'Phi-3 Mini',      ram:'3 GB', speed:'Fastest', best:'Low-RAM devices'},
  {id:'qwen2:7b',      label:'Qwen2 7B',        ram:'5 GB', speed:'Fast',    best:'Multilingual'},
];

export default function SettingsPage() {
  const [model,    setModel]   = useState('codellama:7b');
  const [ollama,   setOllama]  = useState('http://localhost:11434');
  const [mem,      setMem]     = useState('4');
  const [tee,      setTee]     = useState('auto');
  const [saved,    setSaved]   = useState(false);

  const save = () => { setSaved(true); setTimeout(()=>setSaved(false),2000); };

  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Configuration</div>
            <h1 className="ph-title">Settings</h1>
            <p className="ph-desc">Configure the local AI engine, privacy settings, and deployment options.</p>
          </div>
          <button className="btn btn-primary" onClick={save}>{saved?'✓ Saved!':'Save Settings'}</button>
        </div>
      </div>

      <div className="pb" style={{display:'flex',flexDirection:'column',gap:'1.1rem'}}>
        {/* Connection Diagnostics */}
        <OllamaDiagnostics />

        {/* Model */}
        <motion.div className="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
          <div className="card-title" style={{marginBottom:'0.2rem'}}>🤖 Local LLM Model</div>
          <div className="card-desc" style={{marginBottom:'0.9rem'}}>All models run locally via Ollama. No data sent to external servers.</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
            {MODELS.map(m=>(
              <div key={m.id} className="card card-sm card-hover" style={model===m.id?{borderColor:'var(--blue2)',background:'rgba(239, 68, 68, 0.05)', boxShadow: '0 0 12px rgba(239, 68, 68, 0.08)'}:{}} onClick={()=>setModel(m.id)}>
                <div style={{display:'flex',alignItems:'center',gap:'0.85rem'}}>
                  <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid var(--rim2)',background:model===m.id?'var(--blue2)':'transparent',flexShrink:0,transition:'all 0.15s'}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--t1)'}}>{m.label}</div>
                    <div style={{fontSize:'0.7rem',color:'var(--t3)'}}>{m.best}</div>
                  </div>
                  <div style={{display:'flex',gap:'0.35rem'}}>
                    <span className="tag tag-blue">{m.ram}</span>
                    <span className="tag tag-green">{m.speed}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Engine */}
        <motion.div className="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.07}}>
          <div className="card-title" style={{marginBottom:'0.9rem'}}>⚡ Data Engine (DuckDB)</div>
          <div className="g2">
            <div className="form-group">
              <label className="form-label">Ollama API URL</label>
              <input className="form-input" value={ollama} onChange={e=>setOllama(e.target.value)} />
              <div style={{fontSize:'0.68rem',color:'var(--t4)',marginTop:3}}>Local Ollama instance endpoint</div>
            </div>
            <div className="form-group">
              <label className="form-label">DuckDB Memory Limit</label>
              <select className="form-input form-select" value={mem} onChange={e=>setMem(e.target.value)}>
                {['2','4','8','16','32'].map(v=><option key={v} value={v}>{v} GB</option>)}
              </select>
            </div>
          </div>
        </motion.div>

        {/* TEE */}
        <motion.div className="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.12}}>
          <div className="card-title" style={{marginBottom:'0.2rem'}}>🔒 Privacy & TEE</div>
          <div className="card-desc" style={{marginBottom:'0.9rem'}}>Hardware Trusted Execution Environment settings.</div>
          <div className="form-group">
            <label className="form-label">TEE Mode</label>
            <select className="form-input form-select" value={tee} onChange={e=>setTee(e.target.value)}>
              <option value="auto">Auto-detect (recommended)</option>
              <option value="sev-snp">AMD SEV-SNP (VM-level encryption)</option>
              <option value="sgx">Intel SGX (Process-level enclave)</option>
              <option value="tdx">Intel TDX (Next-gen VM TEE)</option>
              <option value="none">None (Pure locality only)</option>
            </select>
          </div>
          <div className="code-block">
{`TEE Status  : ${tee==='none'?'Disabled — pure locality mode':'Auto-detecting hardware...'}
Current Mode: ${tee}
Net Monitor : Active
Audit Log   : Ed25519 signing enabled
Bytes Sent  : 0`}
          </div>
        </motion.div>

        {/* About */}
        <motion.div className="card" style={{background:'linear-gradient(135deg,rgba(59,130,246,0.04),rgba(139,92,246,0.04))',borderColor:'rgba(59,130,246,0.15)'}} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.18}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.7rem',marginBottom:'0.75rem'}}>
            <div className="sb-mark" style={{width:30,height:30,fontSize:'0.85rem'}}>P</div>
            <div>
              <div style={{fontWeight:800,fontSize:'0.95rem',color:'var(--t1)'}}>Privana <span style={{color:'var(--blue3)'}}>v0.1.0</span></div>
              <div style={{fontSize:'0.7rem',color:'var(--t3)'}}>Privacy-first AI analytics platform</div>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
            {['Zero Cloud Dependencies','Local LLM via Ollama','DuckDB Analytics Engine','Ed25519 Audit Signing','TEE Hardware Support'].map((t,i)=>(
              <span key={i} className="tag tag-green">{t}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
