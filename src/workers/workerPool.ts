import type { WorkerParseRequest, WorkerParseResult } from './import.worker';

export interface ParseTask {
  sourceId: string;
  relPath: string;
  name: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: {
    task: ParseTask;
    resolve: (res: WorkerParseResult) => void;
    reject: (err: any) => void;
  }[] = [];
  private activeTasks = new Map<string, (res: WorkerParseResult) => void>();
  private taskIdCounter = 0;
  private poolSize: number;

  constructor() {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.poolSize = Math.max(1, Math.min(4, cores - 1));
    this.initPool();
  }

  private initPool() {
    try {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(
          new URL('./import.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<WorkerParseResult>) => {
          const res = e.data;
          const handler = this.activeTasks.get(res.taskId);
          if (handler) {
            this.activeTasks.delete(res.taskId);
            handler(res);
          }
          this.idleWorkers.push(worker);
          this.processNext();
        };

        worker.onerror = (err) => {
          console.error('Worker error:', err);
          this.idleWorkers.push(worker);
          this.processNext();
        };

        this.workers.push(worker);
        this.idleWorkers.push(worker);
      }
    } catch (err) {
      console.warn('Worker initialization failed, fallback will be used:', err);
    }
  }

  public parseFile(task: ParseTask): Promise<WorkerParseResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  private processNext() {
    if (this.taskQueue.length === 0 || this.idleWorkers.length === 0) return;

    const worker = this.idleWorkers.pop()!;
    const item = this.taskQueue.shift()!;
    const taskId = `task_${++this.taskIdCounter}`;

    this.activeTasks.set(taskId, item.resolve);

    const req: WorkerParseRequest = {
      taskId,
      sourceId: item.task.sourceId,
      relPath: item.task.relPath,
      name: item.task.name,
      size: item.task.size,
      lastModified: item.task.lastModified,
      blob: item.task.blob,
    };

    worker.postMessage(req);
  }

  public clearQueue() {
    this.taskQueue = [];
  }

  public terminate() {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
  }
}

export const importWorkerPool = new WorkerPool();
