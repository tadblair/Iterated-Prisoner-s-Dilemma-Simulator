
/**
 * A simple Mulberry32 seeded PRNG for consistent results.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randomAction(pC: number): number {
    return this.next() < pC ? 0 : 1;
  }
}
