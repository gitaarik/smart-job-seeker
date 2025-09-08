import { getEnv } from "$lib/tools/get-env";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async () => {
  return {
    pater: getEnv("PATER"),
  };
};
