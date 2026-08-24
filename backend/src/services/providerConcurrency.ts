import { GENERATION_POLICY } from '../config/generationPolicy.js';

export class AsyncSemaphore {
  private currentRunning = 0;
  private queue: Array<() => void> = [];

  constructor(public readonly maxConcurrency: number, public readonly name: string) {}

  public async acquire(): Promise<() => void> {
    if (this.currentRunning < this.maxConcurrency) {
      this.currentRunning++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.currentRunning++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private release(): void {
    this.currentRunning--;
    if (this.queue.length > 0 && this.currentRunning < this.maxConcurrency) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  public getStats() {
    return {
      name: this.name,
      active: this.currentRunning,
      queued: this.queue.length,
      limit: this.maxConcurrency,
    };
  }
}

export class ProviderConcurrencyManager {
  public readonly gemini: AsyncSemaphore;
  public readonly veo: AsyncSemaphore;
  public readonly voice: AsyncSemaphore;
  public readonly ffmpeg: AsyncSemaphore;

  constructor() {
    this.gemini = new AsyncSemaphore(GENERATION_POLICY.CONCURRENCY.MAX_GEMINI, 'Gemini');
    this.veo = new AsyncSemaphore(GENERATION_POLICY.CONCURRENCY.MAX_VEO, 'Veo');
    this.voice = new AsyncSemaphore(GENERATION_POLICY.CONCURRENCY.MAX_VOICE, 'Voice');
    this.ffmpeg = new AsyncSemaphore(GENERATION_POLICY.CONCURRENCY.MAX_FFMPEG, 'FFmpeg');
  }

  public getAllStats() {
    return {
      gemini: this.gemini.getStats(),
      veo: this.veo.getStats(),
      voice: this.voice.getStats(),
      ffmpeg: this.ffmpeg.getStats(),
    };
  }
}

export const providerConcurrency = new ProviderConcurrencyManager();
