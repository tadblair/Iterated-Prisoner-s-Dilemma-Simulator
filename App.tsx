
import React, { useState, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
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
import { IPDEngine } from './services/ipd-engine';
import { 
  Play, RotateCcw, Settings, TrendingUp, Brain, Cpu, 
  Download, Upload, Copy, Check, BarChart3, Info 
} from 'lucide-react';

const PARAM_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", 
  "#ef4444", "#06b6d4", "#8b5cf6", "#14b8a6"
];

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<SimulationConfig>({
    nTrials: 1000,
    blockSize: 50,
    seed: 42,
    payoff: [
      [3, 0], // C vs C, C vs D
      [5, 1]  // D vs C, D vs D
    ],
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
    initialQ: [
      [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]
    ],
    initialH: [
      [0, 0], [0, 0], [0, 0], [0, 0]
    ]
  });

  const [results, setResults] = useState<BlockResult[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [filename, setFilename] = useState("ipd-config.json");
  const [copied, setCopied] = useState(false);

  const handleTrain = () => {
    setIsTraining(true);
    setTimeout(() => {
      const engine = new IPDEngine(config);
      const { blocks } = engine.run();
      setResults(blocks);
      setIsTraining(false);
    }, 10);
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
    let finalFilename = filename.trim() || "ipd-config.json";
    if (!finalFilename.toLowerCase().endsWith('.json')) finalFilename += ".json";
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    setIsDownloadModalOpen(false);
  };

  const handleUploadConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const newConfig = JSON.parse(e.target?.result as string);
        if (newConfig && typeof newConfig === 'object') {
          setConfig(newConfig);
          setResults([]);
        }
      } catch (err) {
        alert("Invalid configuration file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateConfig = (key: keyof SimulationConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateExplorationConfig = (key: keyof SimulationConfig['explorationConfig'], value: any) => {
    setConfig(prev => ({
      ...prev,
      explorationConfig: { ...prev.explorationConfig, [key]: value }
    }));
  };

  const explorationLabel = config.actionSelection === ActionSelection.SOFTMAX ? 'Tau (Temp)' : 'Epsilon (ε)';
  const parameterKeys = results.length > 0 ? Object.keys(results[0].parameters) : [];
  const isRL = config.agentStrategy === Strategy.RL_AGENT;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-85 bg-white border-r border-gray-200 overflow-y-auto p-6 shadow-sm flex-shrink-0 pb-24">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight">IPD Trainer</h1>
        </div>

        <div className="space-y-8">
          {/* File Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsDownloadModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-colors">
              <Download size={14} /> Save
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-colors">
              <Upload size={14} /> Load
            </button>
            <button onClick={handleCopyConfig} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-colors">
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />} Copy
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleUploadConfig} />
          </div>

          {/* Simulation Settings */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings size={14} /> Simulation
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Total Trials</label>
                  <input type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={config.nTrials} onChange={e => updateConfig('nTrials', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Size</label>
                  <input type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={config.blockSize} onChange={e => updateConfig('blockSize', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Seed</label>
                  <input type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={config.seed} onChange={e => updateConfig('seed', parseInt(e.target.value))} />
                </div>
              </div>
            </div>
          </section>

          {/* Strategies */}
          <section className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Agent Strategy</label>
              <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={config.agentStrategy} onChange={e => updateConfig('agentStrategy', e.target.value)}>
                <option value={Strategy.RL_AGENT}>🤖 RL Agent</option>
                <option value={Strategy.TIT_FOR_TAT}>🤝 Tit-for-Tat</option>
                <option value={Strategy.ALWAYS_C}>🕊️ Always Cooperate</option>
                <option value={Strategy.ALWAYS_D}>⚔️ Always Defect</option>
                <option value={Strategy.RANDOM}>🎲 Random</option>
                <option value={Strategy.GRIM_TRIGGER}>👿 Grim Trigger</option>
                <option value={Strategy.PAVLOV}>🧠 Pavlov</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Opponent Strategy</label>
              <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={config.opponentStrategy} onChange={e => updateConfig('opponentStrategy', e.target.value)}>
                <option value={Strategy.TIT_FOR_TAT}>🤝 Tit-for-Tat</option>
                <option value={Strategy.GRIM_TRIGGER}>👿 Grim Trigger</option>
                <option value={Strategy.PAVLOV}>🧠 Pavlov</option>
                <option value={Strategy.ALWAYS_C}>🕊️ Always Cooperate</option>
                <option value={Strategy.ALWAYS_D}>⚔️ Always Defect</option>
                <option value={Strategy.RANDOM}>🎲 Random</option>
              </select>
            </div>
          </section>

          {/* Brain Config */}
          {isRL && (
            <section className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
              <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <Brain size={14} /> Agent Intelligence
              </h2>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">State Memory</label>
                <select className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm" value={config.stateMemory} onChange={e => updateConfig('stateMemory', parseInt(e.target.value))}>
                  <option value={StateMemory.S1_GLOBAL}>1 State (Reactive)</option>
                  <option value={StateMemory.S2_OPP_MOVE}>2 State (Memory-1)</option>
                  <option value={StateMemory.S4_BOTH_MOVE}>4 State (Full Memory)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Learning Algorithm</label>
                <select className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm" value={config.learningAlgorithm} onChange={e => updateConfig('learningAlgorithm', e.target.value)}>
                  <option value={LearningAlgorithm.Q_INCREMENTAL}>Q-Learning</option>
                  <option value={LearningAlgorithm.REINFORCE_BASELINE}>REINFORCE + Base</option>
                  <option value={LearningAlgorithm.PREFERENCE}>REINFORCE (No Base)</option>
                </select>
              </div>
            </section>
          )}
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 w-full md:w-80 bg-white/80 backdrop-blur-md pt-4 pb-6 px-6 border-t border-gray-100 flex gap-2 shadow-2xl z-20">
          <button onClick={handleTrain} disabled={isTraining} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-200">
            <Play size={18} fill="currentColor" /> {isTraining ? 'Training...' : 'Run Simulation'}
          </button>
          <button onClick={handleReset} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 bg-gray-50">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
          {results.length === 0 ? (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Cpu size={40} className="text-indigo-600" />
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">IPD Training Lab</h2>
              <p className="text-gray-500 max-w-md text-lg leading-relaxed">Configure your agent's learning parameters and click <span className="text-indigo-600 font-bold">Run Simulation</span> to analyze the emergence of cooperation.</p>
            </div>
          ) : (
            <>
              {/* Stat Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Agent Coop" value={`${(results.reduce((a, b) => a + b.pctCooperate, 0) / results.length).toFixed(1)}%`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Opponent Coop" value={`${(results.reduce((a, b) => a + b.oppPctCooperate, 0) / results.length).toFixed(1)}%`} color="pink" icon={<TrendingUp size={16}/>} />
                <StatCard label="Final Avg Reward" value={(results.slice(-5).reduce((a, b) => a + b.meanReward, 0) / 5).toFixed(2)} color="emerald" icon={<BarChart3 size={16}/>} />
              </div>

              {/* Main Charts */}
              <div className="space-y-6">
                <ChartBox title="Evolution of Cooperation" subtitle="Percentage of turns choosing 'Cooperate' over time">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={results} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="block" hide />
                      <YAxis domain={[0, 100]} unit="%" axisLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold'}} />
                      <Line type="monotone" dataKey="pctCooperate" name="Agent" stroke="#6366f1" strokeWidth={4} dot={false} animationDuration={1000} />
                      <Line type="monotone" dataKey="oppPctCooperate" name="Opponent" stroke="#ec4899" strokeWidth={2} strokeDasharray="6 4" dot={false} opacity={0.6} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartBox>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartBox title="Mean Reward" subtitle="Payoff per trial block">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="block" hide />
                        <YAxis axisLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="meanReward" name="Reward" stroke="#10b981" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartBox>

                  <ChartBox title="Exploration Parameter" subtitle={`Tracking ${explorationLabel} decay`}>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="block" hide />
                        <YAxis axisLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="meanExplorationParam" name={explorationLabel} stroke="#f59e0b" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartBox>
                </div>

                {isRL && (
                  <ChartBox title="Brain Parameter Evolution" subtitle="Internal values (Q/Preferences) across memory states">
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="block" hide />
                        <YAxis axisLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconType="rect" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                        {parameterKeys.map((key, idx) => (
                          <Line key={key} type="monotone" dataKey={`parameters.${key}`} name={key} stroke={PARAM_COLORS[idx % PARAM_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartBox>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Save Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 scale-in-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Save Configuration</h2>
            <p className="text-gray-500 text-sm mb-6">Enter a filename to export these settings as JSON.</p>
            <input 
              type="text" 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-6 font-mono"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="my-experiment.json"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setIsDownloadModalOpen(false)} className="flex-1 px-4 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={triggerDownload} className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all active:scale-95">Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string, color: 'indigo' | 'emerald' | 'pink', icon: React.ReactNode }> = ({ label, value, color, icon }) => {
  const styles = {
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    pink: 'text-pink-600 bg-pink-50 border-pink-100'
  };
  return (
    <div className={`p-5 rounded-2xl border shadow-sm ${styles[color]} flex flex-col justify-between h-32`}>
      <div className="flex justify-between items-start opacity-70">
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <h3 className="text-3xl font-black tracking-tight">{value}</h3>
    </div>
  );
};

const ChartBox: React.FC<{ title: string, subtitle: string, children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4 transition-all hover:shadow-md">
    <div>
      <h3 className="text-lg font-black text-gray-900 tracking-tight">{title}</h3>
      <p className="text-xs font-bold text-gray-400">{subtitle}</p>
    </div>
    <div className="pt-2">{children}</div>
  </div>
);

export default App;
