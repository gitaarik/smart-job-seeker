import { page } from "$app/state";

export function getImg(uuid: string): string {
  return page.data.adminPublicUrl + "/assets/" + uuid;
}
