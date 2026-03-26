const fs = require('fs');
const path = require('path');

// Simple persistent queue for cleanup jobs (move/delete) with periodic retries.
// Jobs are persisted to uploads/cleanup-queue.json so retries survive restarts.

class CleanupService {
  constructor(opts = {}) {
    this.uploadsDir = opts.uploadsDir || path.resolve(path.join(__dirname, '..', '..', 'uploads'));
    this.queueFile = path.join(this.uploadsDir, 'cleanup-queue.json');
    this.intervalMs = opts.intervalMs || 60_000;
    this.maxAttempts = opts.maxAttempts || 10;
    this.jobs = [];
    this.timer = null;
    this.isProcessing = false;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const raw = fs.readFileSync(this.queueFile, 'utf8');
        this.jobs = JSON.parse(raw || '[]');
      } else {
        this.jobs = [];
      }
    } catch (e) {
      console.error('cleanupService: failed to load queue file', e && e.message);
      this.jobs = [];
    }
  }

  _persist() {
    try {
      if (!fs.existsSync(this.uploadsDir)) fs.mkdirSync(this.uploadsDir, { recursive: true });
      fs.writeFileSync(this.queueFile, JSON.stringify(this.jobs, null, 2));
    } catch (e) {
      console.error('cleanupService: failed to persist queue', e && e.message);
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick(), this.intervalMs);
    // run one immediately
    setImmediate(() => this._tick());
    console.log('cleanupService: started (intervalMs=', this.intervalMs, ')');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this._processQueue().finally(() => { this.isProcessing = false; });
  }

  _processQueue() {
    const now = Date.now();
    const jobsToProcess = this.jobs.filter(j => !j.nextAttemptAt || j.nextAttemptAt <= now);
    if (jobsToProcess.length === 0) return Promise.resolve();

    return jobsToProcess.reduce((p, job) => p.then(() => this._processJob(job)), Promise.resolve())
      .then(() => this._persist())
      .catch(err => console.error('cleanupService: processing error', err && err.message));
  }

  async _processJob(job) {
    job.attempts = (job.attempts || 0) + 1;
    job.lastAttempt = Date.now();
    try {
      if (job.type === 'delete') {
        if (fs.existsSync(job.path)) {
          await fs.promises.unlink(job.path);
          this._removeJob(job.id);
          console.log('cleanupService: deleted', job.path);
        } else {
          this._removeJob(job.id);
        }
      } else if (job.type === 'move') {
        // try rename first
        try {
          // ensure target dir
          const targetDir = path.dirname(job.dest);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          await fs.promises.rename(job.src, job.dest);
          this._removeJob(job.id);
          console.log('cleanupService: moved', job.src, '->', job.dest);
        } catch (err) {
          // fallback to copy+unlink for cross-device or locked-file cases
          if (err && (err.code === 'EXDEV' || err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
            try {
              await fs.promises.copyFile(job.src, job.dest);
              try { await fs.promises.unlink(job.src); } catch (uerr) {
                // keep the original and schedule another delete attempt
                console.warn('cleanupService: copy succeeded but unlink failed (will retry):', job.src, uerr && uerr.message);
                job.nextAttemptAt = Date.now() + (job.attempts * 60_000);
                return; // persist job for later
              }
              this._removeJob(job.id);
              console.log('cleanupService: copied+removed', job.src, '->', job.dest);
            } catch (copyErr) {
              console.warn('cleanupService: move attempt failed, will retry', job.src, copyErr && (copyErr.message || copyErr));
              job.nextAttemptAt = Date.now() + (job.attempts * 60_000);
            }
          } else {
            console.warn('cleanupService: move failed (non-retriable?)', err && err.message || err);
            // schedule a future retry anyway
            job.nextAttemptAt = Date.now() + (job.attempts * 60_000);
          }
        }
      }
    } catch (e) {
      console.error('cleanupService: job processing error', e && e.message);
      job.nextAttemptAt = Date.now() + (job.attempts * 60_000);
    }

    // remove jobs that exceeded max attempts
    if (job.attempts >= this.maxAttempts) {
      console.error('cleanupService: job exceeded max attempts, removing:', job);
      this._removeJob(job.id);
    }
  }

  _removeJob(id) {
    const idx = this.jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      this.jobs.splice(idx, 1);
    }
  }

  _saveJob(job) {
    this.jobs = this.jobs.filter(j => j.id !== job.id).concat([job]);
    this._persist();
  }

  enqueueDelete(p) {
    if (!p) return;
    const job = {
      id: 'del_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type: 'delete',
      path: p,
      attempts: 0,
      createdAt: Date.now()
    };
    this._saveJob(job);
    console.log('cleanupService: enqueued delete', p);
  }

  enqueueMove(src, dest) {
    if (!src || !dest) return;
    const job = {
      id: 'mv_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type: 'move',
      src,
      dest,
      attempts: 0,
      createdAt: Date.now()
    };
    this._saveJob(job);
    console.log('cleanupService: enqueued move', src, '->', dest);
  }
}

module.exports = function createCleanupService(opts) {
  const s = new CleanupService(opts);
  return {
    start: () => s.start(),
    stop: () => s.stop(),
    enqueueDelete: (p) => s.enqueueDelete(p),
    enqueueMove: (src, dest) => s.enqueueMove(src, dest),
    _raw: s
  };
};
