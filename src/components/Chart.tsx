import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const C = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#f97316','#ec4899'];
const TT = { contentStyle:{ background:'#0f1828', border:'1px solid #1b2e4a', borderRadius:8, fontSize:'0.7rem', color:'#eef2ff' } };

const fmt = (v:unknown) => {
  if (typeof v!=='number') return String(v);
  if (v>=1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v>=1_000) return `${(v/1_000).toFixed(0)}K`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
};

export default function Chart({ data, type, height=240 }:{ data:Record<string,unknown>[]; type:string; height?:number }) {
  if (!data?.length) return <div style={{textAlign:'center',padding:'2rem',color:'var(--t4)',fontFamily:'var(--mono)',fontSize:'0.7rem'}}>No data</div>;

  const keys   = Object.keys(data[0]);
  const numK   = keys.filter(k=>typeof data[0][k]==='number');
  const strK   = keys.find(k=>typeof data[0][k]==='string') || keys[0];
  const valK   = numK[0] || keys[1];
  const val2K  = numK[1];
  const xKey   = (data[0] as any).label ? 'label' : strK;

  if (type==='line') return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{top:4,right:8,left:0,bottom:4}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1b2e4a" />
        <XAxis dataKey={xKey} tick={{fontSize:9,fill:'#4d6a8a'}} />
        <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#4d6a8a'}} width={44} />
        <Tooltip {...TT} formatter={(v:unknown)=>[fmt(v),'']} />
        <Line type="monotone" dataKey={valK} stroke="#3b82f6" strokeWidth={2} dot={{r:3,fill:'#3b82f6'}} activeDot={{r:5}} />
        {val2K && <Line type="monotone" dataKey={val2K} stroke="#10b981" strokeWidth={2} dot={{r:3,fill:'#10b981'}} />}
      </LineChart>
    </ResponsiveContainer>
  );

  if (type==='pie') return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={valK} nameKey={strK} cx="50%" cy="50%" outerRadius={height/2.8}
          label={false} labelLine={false}>
          {data.map((_,i)=><Cell key={i} fill={C[i%C.length]} />)}
        </Pie>
        <Tooltip {...TT} formatter={(v:unknown)=>[fmt(v),'']} />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{top:4,right:8,left:0,bottom:22}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1b2e4a" />
        <XAxis dataKey={strK} tick={{fontSize:8,fill:'#4d6a8a'}} angle={-30} textAnchor="end" interval={0} />
        <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#4d6a8a'}} width={44} />
        <Tooltip {...TT} formatter={(v:unknown)=>[fmt(v),'']} />
        <Bar dataKey={valK} radius={[4,4,0,0]}>
          {data.map((_,i)=><Cell key={i} fill={C[i%C.length]} />)}
        </Bar>
        {val2K && <Bar dataKey={val2K} fill="#10b981" radius={[4,4,0,0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}
