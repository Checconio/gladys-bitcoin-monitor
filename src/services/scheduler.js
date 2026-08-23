export class Scheduler {
  constructor({ logger, random = Math.random } = {}) {
    this.logger = logger;
    this.random = random;
    this.generation = 0;
    this.timers = new Map();
    this.active = new Set();
  }

  jitter(intervalMs) {
    return Math.floor(Math.min(5000, intervalMs * 0.05) * this.random());
  }

  async reconfigure(tasks) {
    await this.stop();
    const generation = this.generation;
    for (const task of tasks) this.schedule(task, generation);
  }

  schedule(task, generation) {
    const delay =
      task.intervalSeconds * 1000 + this.jitter(task.intervalSeconds * 1000);
    const timer = setTimeout(async () => {
      this.timers.delete(task.name);
      if (generation !== this.generation) return;
      const execution = Promise.resolve()
        .then(task.run)
        .catch((error) =>
          this.logger?.error(`Scheduled task ${task.name} failed`, error),
        );
      this.active.add(execution);
      await execution.finally(() => this.active.delete(execution));
      if (generation === this.generation) this.schedule(task, generation);
    }, delay);
    timer.unref?.();
    this.timers.set(task.name, timer);
  }

  async stop() {
    this.generation += 1;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled([...this.active]);
  }
}
