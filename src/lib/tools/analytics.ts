import { getWindowVariable } from "./window";

export function track(name: string): void {
  const umami = getWindowVariable("umami");

  if (umami && typeof umami.track === "function") {
    umami.track(name);
  }
}

type IdentifyData = {
  id: string;
  [key: string]: string | number | boolean | undefined;
};

export function identify(data: IdentifyData): void {
  const umami = getWindowVariable("umami");

  if (umami && typeof umami.identify === "function") {
    umami.identify(data);
  }
}
