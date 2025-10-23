import { getEnv } from "./get-env";

export function getImg(uuid) {
  return getEnv("ADMIN_PUBLIC_URL") + "assets/" + uuid;
}
