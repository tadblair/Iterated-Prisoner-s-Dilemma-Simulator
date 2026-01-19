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
  BlockResult,
  Action
} from './types';
import { IPDEngine } from './ipd-engine';
import { 
  Play, RotateCcw, Settings, TrendingUp, Brain, Download, Upload, Copy, Check, Zap, Info, ChevronDown, ChevronUp
} from 'lucide-react';

const PARAM_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#14b8a6"];

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<SimulationConfig>({
    nTrials: 2000,
    blockSize: 100,
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
      slope: 0.001,
      startTrial: 500
    },
    initialQ: [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]],
    initialH: [[0, 0], [0, 0], [0, 0], [0, 0]]
  });

  const [results, setResults] = useState<BlockResult[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [filename, setFilename] = useState("ipd-experiment.json");
  const [copied, setCopied] = useState(false);
  
  // Section toggle state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    env: true,
    rl: true,
    initial: false,
    exploration: true
  });

  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const handleTrain = () => {
    setIsTraining(true);
    // Use a small delay to allow UI to show loading state
    setTimeout(() => {
      try {
        const engine = new IPDEngine(config);
        const { blocks } = engine.run();
        setResults(blocks);
      } catch (error) {
        console.error("Simulation failed:", error);
      } finally {
        setIsTraining(false);
      }
    }, 100);
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

  const updateExploration = (key: keyof typeof config.explorationConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      explorationConfig: { ...prev.explorationConfig, [key]: value }
    }));
  };

  const updatePayoff = (row: number, col: number, val: number) => {
    const newPayoff = [...config.payoff.map(r => [...r])];
    newPayoff[row][col] = val;
    updateConfig('payoff', newPayoff);
  };

  const updateInitialVal = (type: 'initialQ' | 'initialH', stateIdx: number, actionIdx: number, val: number) => {
    const newVal = [...config[type].map(r => [...r])];
    newVal[stateIdx][actionIdx] = val;
    updateConfig(type, newVal);
  };

  const isRL = config.agentStrategy === Strategy.RL_AGENT;
  const parameterKeys = results.length > 0 ? Object.keys(results[0].parameters) : [];

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-50">
      <aside className="w-full md:w-96 bg-white border-r border-slate-200 overflow-y-auto p-6 flex-shrink-0 flex flex-col pb-32 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
            <TrendingUp className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 leading-none">IPD Trainer</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Research Platform</p>
          </div>
        </div>

        <div className="space-y-6 flex-1">
          {/* Action Bar */}
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

          {/* Environment Section */}
          <section className="border border-slate-100 rounded-2xl overflow-hidden">
            <CollapsibleHeader title="Environment" icon={<Settings size={14}/>} isOpen={openSections.env} onToggle={() => toggleSection('env')} />
            {openSections.env && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <InputGroup label="Trials" value={config.nTrials} onChange={v => updateConfig('nTrials', parseInt(v))} />
                  <InputGroup label="Seed" value={config.seed} onChange={v => updateConfig('seed', parseInt(v))} />
                </div>
                
                {/* Payoff Matrix Editor */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payoff Matrix [Agent, Opp]</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl">
                    <PayoffInput label="C,C" value={config.payoff[0][0]} onChange={v => updatePayoff(0, 0, v)} />
                    <PayoffInput label="C,D" value={config.payoff[0][1]} onChange={v => updatePayoff(0, 1, v)} />
                    <PayoffInput label="D,C" value={config.payoff[1][0]} onChange={v => updatePayoff(1, 0, v)} />
                    <PayoffInput label="D,D" value={config.payoff[1][1]} onChange={v => updatePayoff(1, 1, v)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <SelectGroup 
                    label="Agent Mode" 
                    value={config.agentStrategy} 
                    onChange={v => updateConfig('agentStrategy', v)}
                    options={[
                      { label: "🤖 RL Learner", value: Strategy.RL_AGENT },
                      { label: "🤝 Tit-for-Tat", value: Strategy.TIT_FOR_TAT },
                      { label: "🕊️ Always Coop", value: Strategy.ALWAYS_C },
                      { label: "⚔️ Always Defect", value: Strategy.ALWAYS_D },
                      { label: "🧠 Pavlov", value: Strategy.PAVLOV }
                    ]}
                  />
                  <SelectGroup 
                    label="Opponent Type" 
                    value={config.opponentStrategy} 
                    onChange={v => updateConfig('opponentStrategy', v)}
                    options={[
                      { label: "🤝 Tit-for-Tat", value: Strategy.TIT_FOR_TAT },
                      { label: "👿 Grim Trigger", value: Strategy.GRIM_TRIGGER },
                      { label: "🧠 Pavlov (WSLS)", value: Strategy.PAVLOV },
                      { label: "🎲 Random", value: Strategy.RANDOM },
                      { label: "🕊️ Always C", value: Strategy.ALWAYS_C },
                      { label: "⚔️ Always D", value: Strategy.ALWAYS_D }
                    ]}
                  />
                  {config.opponentStrategy === Strategy.RANDOM && (
                    <div className="px-1">
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opponent P(Coop)</label>
                        <span className="text-[10px] font-bold text-indigo-600">{(config.pCooperateOpponent * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={config.pCooperateOpponent} 
                        onChange={e => updateConfig('pCooperateOpponent', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* RL Engine Section */}
          {isRL && (
            <section className="border border-indigo-50 rounded-2xl overflow-hidden bg-indigo-50/20">
              <CollapsibleHeader title="RL Engine" icon={<Brain size={14}/>} isOpen={openSections.rl} onToggle={() => toggleSection('rl')} theme="indigo" />
              {openSections.rl && (
                <div className="p-4 space-y-4">
                  <SelectGroup 
                    label="Algorithm" 
                    value={config.learningAlgorithm} 
                    onChange={v => updateConfig('learningAlgorithm', v)}
                    options={[
                      { label: "Q-Learning (Inc)", value: LearningAlgorithm.Q_INCREMENTAL },
                      { label: "REINFORCE + Baseline", value: LearningAlgorithm.REINFORCE_BASELINE },
                      { label: "REINFORCE (No Baseline)", value: LearningAlgorithm.PREFERENCE }
                    ]}
                  />
                  <SelectGroup 
                    label="Action Selection" 
                    value={config.actionSelection} 
                    onChange={v => updateConfig('actionSelection', v)}
                    options={[
                      { label: "Softmax (Tau)", value: ActionSelection.SOFTMAX },
                      { label: "ε-Greedy", value: ActionSelection.EPSILON_GREEDY },
                      { label: "UCB1", value: ActionSelection.UCB }
                    ]}
                  />
                  <SelectGroup 
                    label="Memory Window" 
                    value={config.stateMemory} 
                    onChange={v => updateConfig('stateMemory', parseInt(v))}
                    options={[
                      { label: "S1: Memoryless", value: StateMemory.S1_GLOBAL },
                      { label: "S2: Memory-1 (Opp)", value: StateMemory.S2_OPP_MOVE },
                      { label: "S4: Context (Both)", value: StateMemory.S4_BOTH_MOVE }
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <InputGroup label="LR (α)" step="0.01" value={config.alpha || 0.1} onChange={v => updateConfig('alpha', parseFloat(v))} />
                    <InputGroup label="Discount (γ)" step="0.01" value={config.gamma} onChange={v => updateConfig('gamma', parseFloat(v))} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Exploration Section */}
          {isRL && (
            <section className="border border-slate-100 rounded-2xl overflow-hidden">
              <CollapsibleHeader title="Exploration Schedule" icon={<Zap size={14}/>} isOpen={openSections.exploration} onToggle={() => toggleSection('exploration')} />
              {openSections.exploration && (
                <div className="p-4 space-y-4">
                  <SelectGroup 
                    label="Schedule Type" 
                    value={config.explorationConfig.schedule} 
                    onChange={v => updateExploration('schedule', v)}
                    options={[
                      { label: "Constant", value: ExplorationSchedule.NONE },
                      { label: "Linear Decay", value: ExplorationSchedule.LINEAR },
                      { label: "Exponential Decay", value: ExplorationSchedule.EXP }
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <InputGroup label="Start (τ/ε)" step="0.1" value={config.explorationConfig.start} onChange={v => updateExploration('start', parseFloat(v))} />
                    <InputGroup label="Min Value" step="0.01" value={config.explorationConfig.min} onChange={v => updateExploration('min', parseFloat(v))} />
                    <InputGroup label="Anneal Start" value={config.explorationConfig.startTrial} onChange={v => updateExploration('startTrial', parseInt(v))} />
                    {config.explorationConfig.schedule === ExplorationSchedule.LINEAR ? (
                      <InputGroup label="Slope" step="0.0001" value={config.explorationConfig.slope} onChange={v => updateExploration('slope', parseFloat(v))} />
                    ) : (
                      <InputGroup label="Decay Rate" step="0.001" value={config.explorationConfig.decay} onChange={v => updateExploration('decay', parseFloat(v))} />
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Initial Values Section */}
          {isRL && (
            <section className="border border-slate-100 rounded-2xl overflow-hidden">
              <CollapsibleHeader title="Initial Estimates" icon={<Info size={14}/>} isOpen={openSections.initial} onToggle={() => toggleSection('initial')} />
              {openSections.initial && (
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set {config.learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL ? 'Q' : 'Preference'} Estimates</p>
                    {Array.from({ length: config.stateMemory }).map((_, s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="w-8 text-[10px] font-bold text-slate-300">S{s}</span>
                        <div className="grid grid-cols-2 gap-1 flex-1">
                          <input 
                            type="number" step="0.1"
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-indigo-400"
                            value={config.learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL ? config.initialQ[s][0] : config.initialH[s][0]}
                            onChange={e => updateInitialVal(config.learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL ? 'initialQ' : 'initialH', s, 0, parseFloat(e.target.value))}
                            placeholder="C"
                          />
                          <input 
                            type="number" step="0.1"
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-indigo-400"
                            value={config.learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL ? config.initialQ[s][1] : config.initialH[s][1]}
                            onChange={e => updateInitialVal(config.learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL ? 'initialQ' : 'initialH', s, 1, parseFloat(e.target.value))}
                            placeholder="D"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="fixed bottom-0 left-0 w-full md:w-96 bg-white/95 backdrop-blur-md pt-4 pb-8 px-6 border-t border-slate-100 z-30">
          <div className="flex gap-2">
            <button 
              onClick={handleTrain} 
              disabled={isTraining}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-indigo-100 group overflow-hidden relative"
            >
              {isTraining ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play size={20} fill="currentColor" />
                  <span>Start Simulation</span>
                </>
              )}
            </button>
            <button onClick={handleReset} className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-colors">
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-12 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          {results.length === 0 ? (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center opacity-80">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-8 animate-bounce">
                <Zap size={48} className="text-indigo-600" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Ready to Train?</h2>
              <p className="text-slate-500 max-w-md text-lg font-medium leading-relaxed">
                Adjust your agent's neural parameters, exploration schedule, and initial state values in the sidebar. Click Run to visualize game theory dynamics.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <MetricCard label="Agent Cooperation" value={`${(results.reduce((a, b) => a + b.pctCooperate, 0) / results.length).toFixed(1)}%`} color="indigo" />
                <MetricCard label="Opponent Cooperation" value={`${(results.reduce((a, b) => a + b.oppPctCooperate, 0) / results.length).toFixed(1)}%`} color="pink" />
                <MetricCard label="Convergence Score" value={(results.slice(-Math.max(1, Math.floor(results.length/10))).reduce((a, b) => a + b.meanReward, 0) / Math.max(1, Math.floor(results.length/10))).toFixed(2)} color="emerald" />
              </div>

              <div className="grid grid-cols-1 gap-8">
                <ChartCard title="Cooperation Dynamics" subtitle="Interaction history over blocks">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={results}>
                        <defs>
                          <linearGradient id="colorAgent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorOpp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.1}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="block" label={{ value: 'Simulation Block', position: 'bottom', offset: -5, fontSize: 10, fill: '#94a3b8' }} hide />
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
                  <ChartCard title="Payoff Efficiency" subtitle="Block-averaged reward performance">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="block" hide />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                          <Tooltip />
                          <Line type="monotone" dataKey="meanReward" name="Avg Payoff" stroke="#10b981" strokeWidth={4} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title="Internal Model Values" subtitle="Q/H evolution for individual states">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="block" hide />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                          <Tooltip />
                          <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                          {parameterKeys.map((key, idx) => (
                            <Line key={key} type="monotone" dataKey={`parameters.${key}`} name={key} stroke={PARAM_COLORS[idx % PARAM_COLORS.length]} strokeWidth={2} dot={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>

                <ChartCard title="Exploration Parameter (Annealing)" subtitle="Evolution of τ (Softmax) or ε (ε-Greedy)">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="block" hide />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="meanExplorationParam" name="Exploration Param" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Export Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-10 transform transition-all animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Export Data</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Download these parameters as JSON.</p>
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

/* --- UI Subcomponents --- */

const MetricCard: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => {
  const styles: any = {
    indigo: 'bg-indigo-600 text-white shadow-indigo-100',
    pink: 'bg-pink-600 text-white shadow-pink-100',
    emerald: 'bg-emerald-600 text-white shadow-emerald-100'
  };
  return (
    <div className={`${styles[color]} p-8 rounded-3xl shadow-2xl flex flex-col justify-between h-40 group transition-transform hover:-translate-y-1`}>
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

const CollapsibleHeader: React.FC<{ title: string, icon: React.ReactNode, isOpen: boolean, onToggle: () => void, theme?: 'indigo' | 'slate' }> = ({ title, icon, isOpen, onToggle, theme = 'slate' }) => (
  <button 
    onClick={onToggle}
    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${theme === 'indigo' ? 'bg-indigo-100/50 hover:bg-indigo-100 text-indigo-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
  >
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
    </div>
    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
  </button>
);

const InputGroup: React.FC<{ label: string, value: any, onChange: (v: string) => void, type?: string, step?: string }> = ({ label, value, onChange, type = "number", step }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
    <input 
      type={type} step={step}
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);

const SelectGroup: React.FC<{ label: string, value: any, onChange: (v: any) => void, options: { label: string, value: any }[] }> = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
    <select 
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
      value={value} 
      onChange={e => onChange(e.target.value)}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const PayoffInput: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-8">
    <span className="px-2 text-[9px] font-black text-slate-300 border-r border-slate-100">{label}</span>
    <input 
      type="number" className="w-full h-full text-xs text-center font-bold outline-none" 
      value={value} onChange={e => onChange(parseInt(e.target.value))} 
    />
  </div>
);

export default App;
