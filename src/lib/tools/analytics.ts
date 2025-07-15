import { track as vercelTrack } from "@vercel/analytics";
import { getWindowVariable } from "./window";

export function track(name: string): void {
  vercelTrack(name);

  const umami = getWindowVariable('umami')

  if (typeof umami.track === "function") {
    umami.track(name);
  }
}
