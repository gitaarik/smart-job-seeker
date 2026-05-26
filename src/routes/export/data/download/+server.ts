import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) => {
  const target = `/data/profile-export/download${url.search}`;
  redirect(301, target);
};
