import { parseTrackDirect, type WorkerParseRequest, type WorkerParseResult } from './import.worker';

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
  private activeTasks = new Map<string, {
    resolve: (res: WorkerParseResult) => void;
    timer: ReturnType<typeof setTimeout>;
    req: WorkerParseRequest;
  }>();
  private taskIdCounter = 0;
  private poolSize: number;

  constructor() {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.poolSize = Math.max(1, Math.min(4, cores - 1));
    this.initPool();
  }

  private initPool() {
    const isElectronOrFile =
      typeof window !== 'undefined' &&
      (Boolean((window as any).sonara) ||
        Boolean((window as any).electronAPI) ||
        window.location.protocol === 'file:' ||
        navigator.userAgent.includes('Electron'));

    if (isElectronOrFile) {
      // In Electron or file:// protocol, Web Workers with type: 'module' are blocked by Chromium
      // file:// security policies. Use high-speed in-thread direct parsing instead.
      this.workers = [];
      this.idleWorkers = [];
      return;
    }

    try {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(
          new URL('./import.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<WorkerParseResult>) => {
          const res = e.data;
          const entry = this.activeTasks.get(res.taskId);
          if (entry) {
            clearTimeout(entry.timer);
            this.activeTasks.delete(res.taskId);
            entry.resolve(res);
          }
          this.idleWorkers.push(worker);
          this.processNext();
        };

        worker.onerror = (err) => {
          console.warn('Worker encountered error, disabling worker and using direct parser:', err);
          try {
            worker.terminate();
          } catch {}
          this.workers = this.workers.filter((w) => w !== worker);
          this.idleWorkers = this.idleWorkers.filter((w) => w !== worker);

          // Fall back all pending tasks assigned to this worker
          for (const [taskId, entry] of Array.from(this.activeTasks.entries())) {
            clearTimeout(entry.timer);
            this.activeTasks.delete(taskId);
            void parseTrackDirect(entry.req).then(entry.resolve);
          }
          this.processNext();
        };

        this.workers.push(worker);
        this.idleWorkers.push(worker);
      }
    } catch (err) {
      console.warn('Worker initialization not supported or failed, using in-thread parser:', err);
      this.workers = [];
      this.idleWorkers = [];
    }
  }

  public async parseFile(task: ParseTask): Promise<WorkerParseResult> {
    // If worker pool failed to initialize (e.g. running from file://), parse directly in thread
    if (this.workers.length === 0) {
      const taskId = `task_direct_${++this.taskIdCounter}`;
      return parseTrackDirect({
        taskId,
        sourceId: task.sourceId,
        relPath: task.relPath,
        name: task.name,
        size: task.size,
        lastModified: task.lastModified,
        blob: task.blob,
      });
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  private processNext() {
    if (this.taskQueue.length === 0) return;

    if (this.idleWorkers.length === 0) {
      // If all workers busy, but tasks are waiting, drain with direct parser if queued > 8
      if (this.taskQueue.length > 8) {
        const item = this.taskQueue.shift();
        if (item) {
          const taskId = `task_fast_${++this.taskIdCounter}`;
          const req: WorkerParseRequest = {
            taskId,
            sourceId: item.task.sourceId,
            relPath: item.task.relPath,
            name: item.task.name,
            size: item.task.size,
            lastModified: item.task.lastModified,
            blob: item.task.blob,
          };
          void parseTrackDirect(req).then(item.resolve).catch(item.reject);
        }
      }
      return;
    }

    const worker = this.idleWorkers.pop()!;
    const item = this.taskQueue.shift()!;
    const taskId = `task_${++this.taskIdCounter}`;

    const req: WorkerParseRequest = {
      taskId,
      sourceId: item.task.sourceId,
      relPath: item.task.relPath,
      name: item.task.name,
      size: item.task.size,
      lastModified: item.task.lastModified,
      blob: item.task.blob,
    };

    // Safety timeout: if worker doesn't finish in 3500ms, parse directly in thread
    const timer = setTimeout(() => {
      const entry = this.activeTasks.get(taskId);
      if (entry) {
        this.activeTasks.delete(taskId);
        console.warn(`Worker task ${taskId} timed out after 3.5s, falling back to direct parse`);
        void parseTrackDirect(req).then(entry.resolve).catch((err) => {
          entry.resolve({
            taskId,
            success: false,
            error: err?.message || 'Parse timeout fallback error',
          });
        });
      }
    }, 3500);

    this.activeTasks.set(taskId, { resolve: item.resolve, timer, req });

    try {
      worker.postMessage(req);
    } catch (postErr) {
      clearTimeout(timer);
      this.activeTasks.delete(taskId);
      this.idleWorkers.push(worker);
      void parseTrackDirect(req).then(item.resolve).catch(item.reject);
    }
  }

  public clearQueue() {
    this.taskQueue = [];
    for (const [, entry] of this.activeTasks) {
      clearTimeout(entry.timer);
    }
    this.activeTasks.clear();
  }

  public terminate() {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.idleWorkers = [];
    this.clearQueue();
  }
}

export const importWorkerPool = new WorkerPool();
