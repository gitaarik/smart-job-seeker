import { readFileSync } from "fs";

export function isRunningInDocker() {
  try {
    const cgroup = readFileSync("/proc/1/cgroup", "utf8");
    return /docker|kubepods/.test(cgroup);
  } catch {
    return false; // File doesn't exist or not readable (e.g. Windows, macOS host, or non-container)
  }
}
