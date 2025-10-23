import { ADMIN_PUBLIC_URL } from "$env/static/private";

export function getImg(uuid) {
  return ADMIN_PUBLIC_URL + "assets/" + uuid;
}
