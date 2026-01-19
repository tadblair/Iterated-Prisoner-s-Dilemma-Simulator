import { 
  Action, 
  Strategy, 
  LearningAlgorithm, 
  ActionSelection,
  StateMemory,
  ExplorationSchedule, 
  SimulationConfig, 
  TrialResult, 
  BlockResult 
} from '../types';
import { SeededRNG } from './rng';

export class IPDEngine {
  private config: SimulationConfig;
  private rng: SeededRNG;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
  }

  private getExplorationParam(trial: number): number {
    const { schedule, start, min, decay, slope, startTrial } = this.config.explorationConfig;
    if (schedule === ExplorationSchedule.NONE || trial < startTrial) return start;

    const t = trial - startTrial;
    if (schedule === ExplorationSchedule.LINEAR) {
      return Math.max(min, start - slope * t);
    } else if (schedule === ExplorationSchedule.EXP) {
      return Math.max(min, start * Math.exp(-decay * t));
    }
    return start;
  }

  private softmax(values: number[], tau: number): number[] {
    const exp = values.map(v => Math.exp(v / Math.max(tau, 1e-6)));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(e => e / sum);
  }

  private selectActionSoftmax(probs: number[]): Action {
    const r = this.rng.next();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) return i as Action;
    }
    return (probs.length - 1) as Action;
  }

  private getParamsSnapshot(Q: number[][], H: number[][], learningAlgorithm: LearningAlgorithm, numStates: number): Record<string, number> {
    const params: Record<string, number> = {};
    const isQ = learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL;
    const source = isQ ? Q : H;
    
    for (let s = 0; s < numStates; s++) {
      params[`S${s}C`] = source[s][0];
      params[`S${s}D`] = source[s][1];
    }
    return params;
  }

  private getState(stateMemory: StateMemory, agentLastAction: Action | null, opponentLastAction: Action | null): number {
    if (stateMemory === StateMemory.S1_GLOBAL) return 0;
    
    // Treat null as Cooperate for initial state encoding
    const aLast = agentLastAction ?? Action.C;
    const oLast = opponentLastAction ?? Action.C;

    if (stateMemory === StateMemory.S2_OPP_MOVE) {
      return oLast; // 0 or 1
    }
    
    if (stateMemory === StateMemory.S4_BOTH_MOVE) {
      // CC=0, CD=1, DC=2, DD=3
      return aLast * 2 + oLast;
    }
    
    return 0;
  }

  private determineStrategyAction(
    strategy: Strategy, 
    t: number, 
    lastOpponentAction: Action | null, 
    ownLastAction: Action | null,
    pCooperate: number,
    state: { grimTriggered: boolean }
  ): Action {
    switch (strategy) {
      case Strategy.ALWAYS_C: return Action.C;
      case Strategy.ALWAYS_D: return Action.D;
      case Strategy.RANDOM: return this.rng.next() < pCooperate ? Action.C : Action.D;
      case Strategy.TIT_FOR_TAT: return t === 0 ? Action.C : (lastOpponentAction ?? Action.C);
      case Strategy.GRIM_TRIGGER:
        if (lastOpponentAction === Action.D) state.grimTriggered = true;
        return state.grimTriggered ? Action.D : Action.C;
      case Strategy.PAVLOV:
        if (t === 0) return Action.C;
        return (ownLastAction === lastOpponentAction) ? Action.C : Action.D;
      default: return Action.C;
    }
  }

  run(): { trials: TrialResult[], blocks: BlockResult[] } {
    const { 
      nTrials, blockSize, payoff, agentStrategy, opponentStrategy, 
      learningAlgorithm, actionSelection, stateMemory,
      alpha, alphaB, alphaPi, gamma, ucbC, initialQ, initialH,
      pCooperate, pCooperateOpponent
    } = this.config;

    const trials: TrialResult[] = [];
    const numStates = stateMemory; // 1, 2, or 4
    
    let agentLastAction: Action | null = null;
    let opponentLastAction: Action | null = null;

    let agentGrimState = { grimTriggered: false };
    let opponentGrimState = { grimTriggered: false };

    const Q = initialQ.slice(0, numStates).map(row => [...row]);
    const N = Array.from({ length: numStates }, () => [0, 0]);
    const H = initialH.slice(0, numStates).map(row => [...row]);
    const b = Array.from({ length: numStates }, () => 0);

    for (let t = 0; t < nTrials; t++) {
      const exParam = this.getExplorationParam(t);
      const s = this.getState(stateMemory, agentLastAction, opponentLastAction);

      let agentAction: Action;
      let probs: number[] = [0.5, 0.5];

      // 1. Determine Agent Action
      if (agentStrategy === Strategy.RL_AGENT) {
        if (learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL) {
          if (actionSelection === ActionSelection.SOFTMAX) {
            probs = this.softmax(Q[s], exParam);
            agentAction = this.selectActionSoftmax(probs);
          } else if (actionSelection === ActionSelection.EPSILON_GREEDY) {
            if (this.rng.next() < exParam) {
              agentAction = this.rng.next() < 0.5 ? Action.C : Action.D;
            } else {
              if (Math.abs(Q[s][0] - Q[s][1]) < 1e-10) {
                agentAction = this.rng.next() < 0.5 ? Action.C : Action.D;
              } else {
                agentAction = Q[s][0] > Q[s][1] ? Action.C : Action.D;
              }
            }
          } else { // UCB
            const totalN = N[s][0] + N[s][1];
            if (N[s][0] === 0 && N[s][1] === 0) {
              agentAction = this.rng.next() < 0.5 ? Action.C : Action.D;
            } else if (N[s][0] === 0) {
              agentAction = Action.C;
            } else if (N[s][1] === 0) {
              agentAction = Action.D;
            } else {
              const ucb0 = Q[s][0] + ucbC * Math.sqrt(Math.log(totalN + 1) / N[s][0]);
              const ucb1 = Q[s][1] + ucbC * Math.sqrt(Math.log(totalN + 1) / N[s][1]);
              if (Math.abs(ucb0 - ucb1) < 1e-10) {
                agentAction = this.rng.next() < 0.5 ? Action.C : Action.D;
              } else {
                agentAction = ucb0 > ucb1 ? Action.C : Action.D;
              }
            }
          }
        } else {
          probs = this.softmax(H[s], exParam);
          agentAction = this.selectActionSoftmax(probs);
        }
      } else {
        agentAction = this.determineStrategyAction(agentStrategy, t, opponentLastAction, agentLastAction, pCooperate, agentGrimState);
      }

      // 2. Determine Opponent Action
      const oppAction = this.determineStrategyAction(opponentStrategy, t, agentLastAction, opponentLastAction, pCooperateOpponent, opponentGrimState);

      const reward = payoff[agentAction][oppAction];

      // 3. Update RL Agent if applicable
      if (agentStrategy === Strategy.RL_AGENT) {
        const sNext = this.getState(stateMemory, agentAction, oppAction);

        if (learningAlgorithm === LearningAlgorithm.Q_INCREMENTAL) {
          N[s][agentAction]++;
          const lr = alpha === null ? 1 / N[s][agentAction] : alpha;
          const maxQNext = Math.max(Q[sNext][0], Q[sNext][1]);
          const target = reward + gamma * maxQNext;
          Q[s][agentAction] += lr * (target - Q[s][agentAction]);
        } else {
          const baseline = learningAlgorithm === LearningAlgorithm.REINFORCE_BASELINE ? b[s] : 0;
          const advantage = reward - baseline;
          if (learningAlgorithm === LearningAlgorithm.REINFORCE_BASELINE) {
            b[s] += alphaB * (reward - b[s]);
          }
          const pi = probs;
          for (let i = 0; i < 2; i++) {
            const grad = (i === agentAction ? 1 : 0) - pi[i];
            H[s][i] += alphaPi * advantage * grad;
          }
        }
      }

      trials.push({
        trial: t,
        agentAction,
        opponentAction: oppAction,
        reward,
        explorationParam: exParam,
        parameters: this.getParamsSnapshot(Q, H, learningAlgorithm, numStates)
      });

      agentLastAction = agentAction;
      opponentLastAction = oppAction;
    }

    const blocks: BlockResult[] = [];
    for (let i = 0; i < nTrials; i += blockSize) {
      const slice = trials.slice(i, i + blockSize);
      const cCount = slice.filter(t => t.agentAction === Action.C).length;
      const oppCCount = slice.filter(t => t.opponentAction === Action.C).length;
      const totalReward = slice.reduce((sum, t) => sum + t.reward, 0);
      const totalExParam = slice.reduce((sum, t) => sum + t.explorationParam, 0);
      const finalParams = slice[slice.length - 1].parameters;

      blocks.push({
        block: Math.floor(i / blockSize),
        midpoint: i + slice.length / 2,
        pctCooperate: (cCount / slice.length) * 100,
        oppPctCooperate: (oppCCount / slice.length) * 100,
        meanReward: totalReward / slice.length,
        meanExplorationParam: totalExParam / slice.length,
        parameters: finalParams
      });
    }

    return { trials, blocks };
  }
}
