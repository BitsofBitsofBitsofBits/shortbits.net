export class DraftAutosave {
  constructor({ capture, save, version = null, onState, onSaved, delay = 2000, maxDelay = 10000, timers = globalThis, requestId = () => crypto.randomUUID() }) {
    Object.assign(this, { capture, save, version, onState, onSaved, delay, maxDelay, timers, requestId });
    this.baseline = JSON.stringify(capture());
    this.waiters = [];
    this.stopped = false;
    this.running = false;
    this.checkpoint = false;
    this.pending = null;
    this.error = null;
    this.timer = null;
    this.maxTimer = null;
    this.abort = new AbortController();
  }
  get dirty() { return !this.stopped && JSON.stringify(this.capture()) !== this.baseline; }
  changed() {
    if (this.stopped || this.error) return;
    this.clearTimer();
    if (!this.dirty) { this.clearMaxTimer(); if (!this.running) this.onState(this.version ? "saved" : "idle"); return; }
    this.onState(this.running ? "saving" : "dirty");
    this.timer = this.timers.setTimeout(() => { this.timer = null; void this.drain(); }, this.delay);
    if (this.maxTimer === null) this.maxTimer = this.timers.setTimeout(() => {
      this.maxTimer = null; this.clearTimer(); void this.drain();
    }, this.maxDelay);
  }
  clearTimer() {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }
  clearMaxTimer() {
    if (this.maxTimer !== null) this.timers.clearTimeout(this.maxTimer);
    this.maxTimer = null;
  }
  flush(checkpoint = false) {
    if (this.stopped) return Promise.reject(new Error("This writer session is closed."));
    if (this.error) return Promise.reject(this.error);
    this.clearTimer();
    this.clearMaxTimer();
    this.checkpoint ||= checkpoint;
    const result = new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    void this.drain();
    return result;
  }
  retry() {
    if (this.stopped) return Promise.reject(new Error("This writer session is closed."));
    if (this.error?.code === "40001") return Promise.reject(this.error);
    this.error = null;
    return this.flush();
  }
  pause(error) {
    this.clearTimer();
    this.clearMaxTimer();
    this.error = error;
    this.onState(error.code === "40001" ? "conflict" : "error", error);
  }
  async drain() {
    if (this.running || this.stopped || this.error) return;
    this.running = true;
    try {
      while (!this.stopped && (this.pending || (this.dirty && (this.timer === null || this.waiters.length)) || this.checkpoint)) {
        if (!this.pending) {
          this.clearMaxTimer();
          const snapshot = JSON.parse(JSON.stringify(this.capture()));
          this.pending = { snapshot, version: this.version, requestId: this.requestId(), checkpoint: this.checkpoint };
          this.checkpoint = false;
        }
        const submitted = this.pending;
        this.onState("saving");
        const result = await this.save(submitted, this.abort.signal);
        if (this.stopped) return;
        if (!result || result.request_id !== submitted.requestId || !result.version || result.version === submitted.version) {
          throw new Error("The draft save could not be confirmed. Retry the same save or reload the latest draft.");
        }
        this.onSaved(result);
        this.version = result.version;
        this.baseline = JSON.stringify(submitted.snapshot);
        this.pending = null;
      }
      if (!this.stopped) {
        this.onState(this.dirty ? "dirty" : this.version ? "saved" : "idle");
        for (const waiter of this.waiters.splice(0)) waiter.resolve();
      }
    } catch (error) {
      if (!this.stopped) {
        if (error.definitive || /^(22|23|42)/.test(error.code || "")) {
          this.checkpoint ||= Boolean(this.pending?.checkpoint);
          this.pending = null;
        }
        this.pause(error);
        for (const waiter of this.waiters.splice(0)) waiter.reject(error);
      }
    } finally { this.running = false; }
  }
  stop() {
    this.stopped = true;
    this.clearTimer();
    this.clearMaxTimer();
    this.abort.abort();
    this.pending = null;
    this.baseline = "";
    this.error = null;
    for (const waiter of this.waiters.splice(0)) waiter.reject(new Error("This writer session is closed."));
  }
}
