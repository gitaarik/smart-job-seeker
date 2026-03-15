import { getWindowVariable } from "./window";

export function track(name: string): void {
  const umami = getWindowVariable("umami");

  if (umami && typeof umami.track === "function") {
    umami.track(name);
  }
}
