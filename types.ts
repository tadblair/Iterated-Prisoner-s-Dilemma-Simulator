export enum Action {
  C = 0,
  D = 1
}

export enum Strategy {
  ALWAYS_C = 'always_c',
  ALWAYS_D = 'always_d',
  RANDOM = 'random',
  TIT_FOR_TAT = 'tit_for_tat',
  GRIM_TRIGGER = 'grim_trigger',
  PAVLOV = 'pavlov',
  RL_AGENT = 'rl_agent'
}

export enum LearningAlgorithm {
  Q_INCREMENTAL = 'q_incremental',
  REINFORCE_BASELINE = 'reinforce_baseline',
  PREFERENCE = 'preference' // Renamed to "REINFORCE (no baseline)" in UI
}

export enum ActionSelection {
  SOFTMAX = 'softmax',
  EPSILON_GREEDY = 'epsilon_greedy',
  UCB = 'ucb'
}

export enum StateMemory {
  S1_GLOBAL = 1,
  S2_OPP_MOVE = 2,
  S4_BOTH_MOVE = 4
}

export enum ExplorationSchedule {
  NONE = 'none',
  EXP = 'exp',
  LINEAR = 'linear'
}

export interface SimulationConfig {
  nTrials: number;
  blockSize: number;
  seed: number;
  payoff: number[][]; // [agentAction][opponentAction]
  agentStrategy: Strategy;
  opponentStrategy: Strategy;
  pCooperate: number; // for RANDOM (agent)
  pCooperateOpponent: number; // for RANDOM (opponent)
  learningAlgorithm: LearningAlgorithm;
  actionSelection: ActionSelection;
  stateMemory: StateMemory;
  alpha: number | null; // for Q (incremental 1/N if null)
  alphaB: number; // baseline lr
  alphaPi: number; // policy lr
  gamma: number; // temporal discount factor
  ucbC: number; // UCB exploration constant
  explorationConfig: {
    schedule: ExplorationSchedule;
    start: number; // start tau or epsilon
    min: number;
    decay: number;
    slope: number;
    startTrial: number;
  };
  initialQ: number[][]; // [state][action]
  initialH: number[][]; // [state][action]
}

export interface TrialResult {
  trial: number;
  agentAction: Action;
  opponentAction: Action;
  reward: number;
  explorationParam: number; // tau or epsilon
  parameters: Record<string, number>;
}

export interface BlockResult {
  block: number;
  midpoint: number;
  pctCooperate: number;
  oppPctCooperate: number;
  meanReward: number;
  meanExplorationParam: number;
  parameters: Record<string, number>;
}

