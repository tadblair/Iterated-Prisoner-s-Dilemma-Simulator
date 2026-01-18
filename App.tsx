import React, { useState, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  SimulationConfig, 
  Strategy, 
  LearningAlgorithm, 
  ActionSelection,
  StateMemory,
  ExplorationSchedule, 
  BlockResult
} from './types';
import { IPDEngine } from './ipd-engine';
import { 
  Play, RotateCcw, Settings, TrendingUp, Brain, Cpu, 
  Download, Upload, Copy, Check, BarChart3, Info, Zap
} from 'lucide-react';

const PARAM_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#14b8a6"];

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<SimulationConfig>({
    nTrials: 1000,
    blockSize: 50,
    seed: 42,
    payoff: [[3, 0], [5, 1]],
    agentStrategy: Strategy.RL_AGENT,
    opponentStrategy: Strategy.TIT_FOR_TAT,
    pCooperate: 0.5,
    pCooperateOpponent: 0.5,
    learningAlgorithm: LearningAlgorithm.Q_INCREMENTAL,
    actionSelection: ActionSelection.SOFTMAX,
    stateMemory: StateMemory.S2_OPP_MOVE,
    alpha: 0.1,
    alphaB: 0.1,
    alphaPi: 0.1,
    gamma: 0.9,
    ucbC: 2.0,
    explorationConfig: {
      schedule: ExplorationSchedule.LINEAR,
      start: 1.0,
      min: 0.1,
      decay: 0.01,
      slope: 0.002,
      startTrial: 100
    },
    initialQ: [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]],
    initialH: [[0, 0], [0, 0], [0, 0], [0, 0]]
  });

  const [results, setResults] = useState<BlockResult[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [filename, setFilename] = useState("ipd-experiment.json");
  const [copied, setCopied] = useState(false);

  const handleTrain = () => {
    setIsTraining(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const engine = new IPDEngine(config);
        const { blocks } = engine.run();
        setResults(blocks);
        setIsTraining(false);
      }, 50);
    });
  };

  const handleReset = () => setResults([]);
  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerDownload = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsDownloadModalOpen(false);
  };

  const updateConfig = (key: keyof SimulationConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const isRL = config.agentStrategy === Strategy.RL_AGENT;
  const parameterKeys = results.length > 0 ? Object.keys(results[0].parameters) : [];

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-50">
      <aside className="w-full md:w-80 bg-white border-r border-slate-200 overflow-y-auto p-6 flex-shrink-0 flex flex-col pb-24 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
            <TrendingUp className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">IPD Trainer</h1>
        </div>

        <div className="space-y-8 flex-1">
          <div className="grid grid-cols-3 gap-2">
            <SidebarBtn onClick={() => setIsDownloadModalOpen(true)} icon={<Download size={14}/>} label="Save" />
            <SidebarBtn onClick={() => fileInputRef.current?.click()} icon={<Upload size={14}/>} label="Load" />
            <SidebarBtn onClick={handleCopyConfig} icon={copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14}/>} label="Copy" />
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
               const file = e.target.files?.[0];
               if (!file) return;
               const reader = new FileReader();
               reader.onload = (ev) => {
                 try {
                   setConfig(JSON.parse(ev.target?.result as string));
                   setResults([]);
                 } catch { alert("Error loading file."); }
               };
               reader.readAsText(file);
            }} />
          </div>

          <section>
            <SectionHeader icon={<Settings size={14}/>} title="Environment" />
            <div className="space-y-4">
              <InputGroup label="Total Trials" value={config.nTrials} onChange={v => updateConfig('nTrials', parseInt(v))} />
              <div className="grid grid-cols-2 gap-3">
                <InputGroup label="Block Size" value={config.blockSize} onChange={v => updateConfig('blockSize', parseInt(v))} />
                <InputGroup label="RNG Seed" value={config.seed} onChange={v => updateConfig('seed', parseInt(v))} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Agent Strategy</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={config.agentStrategy} onChange={e => updateConfig('agentStrategy', e.target.value)}>
                <option value={Strategy.RL_AGENT}>🤖 Reinforcement Learner</option>
                <option value={Strategy.TIT_FOR_TAT}>🤝 Tit-for-Tat</option>
                <option value={Strategy.ALWAYS_C}>🕊️ Always Cooperate</option>
                <option value={Strategy.ALWAYS_D}>⚔️ Always Defect</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Opponent Strategy</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={config.opponentStrategy} onChange={e => updateConfig('opponentStrategy', e.target.value)}>
                <option value={Strategy.TIT_FOR_TAT}>🤝 Tit-for-Tat</option>
                <option value={Strategy.GRIM_TRIGGER}>👿 Grim Trigger</option>
                <option value={Strategy.PAVLOV}>🧠 Pavlov (WSLS)</option>
                <option value={Strategy.RANDOM}>🎲 Random Noise</option>
              </select>
            </div>
          </section>

          {isRL && (
            <section className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
              <SectionHeader icon={<Brain size={14} className="text-indigo-600"/>} title="Neural Config" className="text-indigo-600" />
              <div>
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 block">Memory Window</label>
                <select className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-medium" value={config.stateMemory} onChange={e => updateConfig('stateMemory', parseInt(e.target.value))}>
                  <option value={StateMemory.S1_GLOBAL}>Reactive (Memoryless)</option>
                  <option value={StateMemory.S2_OPP_MOVE}>Memory-1 (Last Opp Move)</option>
                  <option value={StateMemory.S4_BOTH_MOVE}>Full Context (Last Pair)</option>
                </select>
              </div>
              <InputGroup label="Learning Rate (α)" type="number" step="0.01" value={config.alpha || 0.1} onChange={v => updateConfig('alpha', parseFloat(v))} />
            </section>
          )}
        </div>

        <div className="fixed bottom-0 left-0 w-full md:w-80 bg-white/90 backdrop-blur-md pt-4 pb-8 px-6 border-t border-slate-100 z-30">
          <div className="flex gap-2">
            <button 
              onClick={handleTrain} 
              disabled={isTraining}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-indigo-200"
            >
              {isTraining ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={20} fill="currentColor" />}
              {isTraining ? 'Simulating...' : 'Run Simulation'}
            </button>
            <button onClick={handleReset} className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-colors">
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {results.length === 0 ? (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center opacity-80">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-8 animate-bounce">
                <Zap size={48} className="text-indigo-600" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Ready to Train?</h2>
              <p className="text-slate-500 max-w-sm text-lg font-medium leading-relaxed">Adjust your agent's learning parameters in the sidebar and click Run to see game theory in action.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <MetricCard label="Agent Cooperation" value={`${(results.reduce((a, b) => a + b.pctCooperate, 0) / results.length).toFixed(1)}%`} color="indigo" />
                <MetricCard label="Opponent Cooperation" value={`${(results.reduce((a, b) => a + b.oppPctCooperate, 0) / results.length).toFixed(1)}%`} color="pink" />
                <MetricCard label="Avg Payoff (Last 10%)" value={(results.slice(-Math.max(1, Math.floor(results.length/10))).reduce((a, b) => a + b.meanReward, 0) / Math.max(1, Math.floor(results.length/10))).toFixed(2)} color="emerald" />
              </div>

              <div className="grid grid-cols-1 gap-8">
                <ChartCard title="Cooperation Dynamics" subtitle="Interaction history over simulated blocks">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={results}>
                        <defs>
                          <linearGradient id="colorAgent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorOpp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.1}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="block" hide />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px'}} />
                        <Area type="monotone" dataKey="pctCooperate" name="Agent Coop %" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAgent)" />
                        <Area type="monotone" dataKey="oppPctCooperate" name="Opponent Coop %" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorOpp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ChartCard title="Payoff Trend" subtitle="Average score per block">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="block" hide />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                          <Tooltip />
                          <Line type="monotone" dataKey="meanReward" name="Payoff" stroke="#10b981" strokeWidth={4} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  {isRL && (
                    <ChartCard title="Internal Value Evolution" subtitle="State-action mapping over time">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={results}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="block" hide />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip />
                            <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                            {parameterKeys.map((key, idx) => (
                              <Line key={key} type="monotone" dataKey={`parameters.${key}`} name={key} stroke={PARAM_COLORS[idx % PARAM_COLORS.length]} strokeWidth={2} dot={false} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-10 transform transition-all animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Export Data</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Download these settings to repeat the experiment later.</p>
            <input 
              type="text" 
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none focus:border-indigo-500 mb-8 font-bold text-slate-700"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="experiment-name"
              autoFocus
            />
            <div className="flex gap-4">
              <button onClick={() => setIsDownloadModalOpen(false)} className="flex-1 px-4 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={triggerDownload} className="flex-2 px-8 py-4 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100">Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => {
  const styles: any = {
    indigo: 'bg-indigo-600 text-white shadow-indigo-100',
    pink: 'bg-pink-600 text-white shadow-pink-100',
    emerald: 'bg-emerald-600 text-white shadow-emerald-100'
  };
  return (
    <div className={`${styles[color]} p-8 rounded-3xl shadow-2xl flex flex-col justify-between h-40`}>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</span>
      <h3 className="text-4xl font-black tracking-tighter">{value}</h3>
    </div>
  );
};

const ChartCard: React.FC<{ title: string, subtitle: string, children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/20 transition-all duration-300 group">
    <div className="mb-6">
      <h3 className="text-xl font-extrabold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{title}</h3>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
    </div>
    {children}
  </div>
);

const SidebarBtn: React.FC<{ onClick: () => void, icon: React.ReactNode, label: string }> = ({ onClick, icon, label }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl border border-slate-100 transition-all active:scale-95">
    {icon}
    <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const SectionHeader: React.FC<{ icon: React.ReactNode, title: string, className?: string }> = ({ icon, title, className }) => (
  <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${className || 'text-slate-400'}`}>
    {icon} {title}
  </h2>
);

const InputGroup: React.FC<{ label: string, value: any, onChange: (v: string) => void, type?: string, step?: string }> = ({ label, value, onChange, type = "number", step }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
    <input 
      type={type} step={step}
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);
