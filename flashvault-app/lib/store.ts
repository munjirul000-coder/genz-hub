import fs from "fs";
import path from "path";

// Simple async mutex for file writes to prevent race conditions
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];
  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const attempt = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
        } else {
          this.queue.push(attempt);
        }
      };
      attempt();
    });
  }
  private release() {
    this.locked = false;
    const next = this.queue.shift();
    if (next) next();
  }
}

export const dbMutex = new Mutex();

export const DB_PATH = path.join(process.cwd(), "data", "db.json");

export function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
