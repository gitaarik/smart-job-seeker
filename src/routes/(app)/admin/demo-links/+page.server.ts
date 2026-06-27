import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { api_keys, profiles } from "$lib/server/db/schema";
import {
  createDemoLink,
  listDemoLinks,
  revokeDemoLink,
} from "$lib/server/demo/links";
import {
  getTemplateStatus,
  seedDemoTemplateFromProfile,
} from "$lib/server/demo/template";

export const load: PageServerLoad = async (event) => {
  const userId = event.locals.user!.id;

  const [links, devices, myProfiles, template] = await Promise.all([
    listDemoLinks(userId),
    db.query.api_keys.findMany({
      where: and(eq(api_keys.user_id, userId), eq(api_keys.revoked, false)),
      columns: { id: true, name: true },
    }),
    db.query.profiles.findMany({
      where: eq(profiles.user_id, userId),
      columns: { id: true, name: true },
      orderBy: (p, { asc }) => asc(p.id),
    }),
    getTemplateStatus(),
  ]);

  return {
    links,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name ?? `Device ${d.id}`,
    })),
    myProfiles: myProfiles.map((p) => ({
      id: p.id,
      name: p.name ?? `Profile ${p.id}`,
    })),
    template,
    origin: event.url.origin,
  };
};

export const actions: Actions = {
  create: async (event) => {
    const userId = event.locals.user!.id;
    const form = await event.request.formData();

    const ttlSeconds = parseInt(form.get("ttl_seconds") as string, 10);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return fail(400, { error: "Pick a valid expiry." });
    }

    const maxRunsRaw = (form.get("max_runs") as string | null)?.trim();
    const maxRuns = maxRunsRaw ? parseInt(maxRunsRaw, 10) : null;
    if (maxRuns !== null && (!Number.isFinite(maxRuns) || maxRuns <= 0)) {
      return fail(400, {
        error: "Run cap must be a positive number, or blank.",
      });
    }

    const deviceApiKeyIds = form.getAll("device_ids")
      .map((v) => parseInt(v as string, 10))
      .filter((n) => Number.isFinite(n));

    try {
      const link = await createDemoLink({
        createdBy: userId,
        deviceApiKeyIds,
        ttlSeconds,
        maxRuns,
      });
      return { created: `${event.url.origin}/demo/${link.token}` };
    } catch (e) {
      return fail(400, {
        error: e instanceof Error ? e.message : "Failed to create link.",
      });
    }
  },

  revoke: async (event) => {
    const userId = event.locals.user!.id;
    const form = await event.request.formData();
    const linkId = parseInt(form.get("link_id") as string, 10);
    if (!Number.isFinite(linkId)) return fail(400, { error: "Bad link id." });
    await revokeDemoLink(linkId, userId);
    return { revoked: true };
  },

  setTemplate: async (event) => {
    const userId = event.locals.user!.id;
    const form = await event.request.formData();
    const profileId = parseInt(form.get("profile_id") as string, 10);
    if (!Number.isFinite(profileId)) {
      return fail(400, { error: "Pick a profile to use as the template." });
    }

    // Only let an admin seed the template from a profile they own.
    const owned = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
      columns: { id: true },
    });
    if (!owned) return fail(400, { error: "That profile isn't yours." });

    try {
      await seedDemoTemplateFromProfile(profileId);
      return { templateSet: true };
    } catch (e) {
      return fail(400, {
        error: e instanceof Error ? e.message : "Failed to set template.",
      });
    }
  },
};
