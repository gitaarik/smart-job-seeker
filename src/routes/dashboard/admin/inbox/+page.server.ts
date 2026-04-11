import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ url }) => {
  const statusFilter = url.searchParams.get("status") || "";
  const handlerFilter = url.searchParams.get("handler") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const perPage = 25;

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (handlerFilter) where.handler = handlerFilter;

  const [emails, total] = await Promise.all([
    db.inbound_emails.findMany({
      where,
      orderBy: { received_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        recipient: true,
        handler: true,
        from_address: true,
        subject: true,
        body_text: true,
        body_html: true,
        status: true,
        extracted_code: true,
        extracted_link: true,
        received_at: true,
        applied_at: true,
        run_id: true,
        verification_address_id: true,
      },
    }),
    db.inbound_emails.count({ where }),
  ]);

  const counts = {
    all: await db.inbound_emails.count(),
    received: await db.inbound_emails.count({ where: { status: "received" } }),
    matched: await db.inbound_emails.count({ where: { status: "matched" } }),
    applied: await db.inbound_emails.count({ where: { status: "applied" } }),
    dropped: await db.inbound_emails.count({ where: { status: "dropped" } }),
  };

  const handlerCounts = await db.inbound_emails.groupBy({
    by: ["handler"],
    _count: { id: true },
  });

  return {
    emails,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    statusFilter,
    handlerFilter,
    counts,
    handlerCounts: Object.fromEntries(
      handlerCounts.map((h) => [h.handler || "unknown", h._count.id]),
    ),
  };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    await db.inbound_emails.delete({ where: { id } });
    return { success: true };
  },
};
