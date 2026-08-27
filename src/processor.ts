import type { CarrierEvent } from "./types.js";

export class TransientProcessingError extends Error {}
export class PermanentProcessingError extends Error {}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  jitterRatio: number;
}

export interface ProcessResult {
  attempts: number;
  delaysMs: number[];
}

type Handler = (event: CarrierEvent, attempt: number) => Promise<void>;
type Sleeper = (delayMs: number) => Promise<void>;
type Random = () => number;

export class ResilientProcessor {
  constructor(
    private readonly handler: Handler,
    private readonly sleeper: Sleeper = async () => undefined,
    private readonly random: Random = Math.random,
    private readonly policy: RetryPolicy = {
      maxAttempts: 4,
      baseDelayMs: 100,
      jitterRatio: 0.2,
    },
  ) {}

  async process(event: CarrierEvent): Promise<ProcessResult> {
    const delaysMs: number[] = [];
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt += 1) {
      try {
        await this.handler(event, attempt);
        return { attempts: attempt, delaysMs };
      } catch (error) {
        if (error instanceof PermanentProcessingError || attempt === this.policy.maxAttempts) {
          throw error;
        }
        if (!(error instanceof TransientProcessingError)) throw error;
        const base = this.policy.baseDelayMs * 2 ** (attempt - 1);
        const jitter = base * this.policy.jitterRatio * this.random();
        const delay = Math.round(base + jitter);
        delaysMs.push(delay);
        await this.sleeper(delay);
      }
    }
    throw new Error("Retry loop exited unexpectedly");
  }
}
