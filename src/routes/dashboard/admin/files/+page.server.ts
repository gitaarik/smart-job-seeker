import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ url }) => {
  const typeFilter = url.searchParams.get("type") || "";
  const usageFilter = url.searchParams.get("usage") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = 50;

  const where: Record<string, unknown> = {};

  if (typeFilter === "pdf") {
    where.type = { contains: "pdf" };
  } else if (typeFilter === "image") {
    where.type = { startsWith: "image/" };
  } else if (typeFilter === "document") {
    where.type = {
      in: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/html",
        "text/plain",
      ],
    };
  } else if (typeFilter === "json") {
    where.type = "application/json";
  }

  if (usageFilter === "cv") {
    where.profiles = { some: {} };
  } else if (usageFilter === "application") {
    where.applications_files = { some: {} };
  } else if (usageFilter === "feedback") {
    where.user_feedback_files = { some: {} };
  } else if (usageFilter === "export") {
    where.profile_exports = { some: {} };
  } else if (usageFilter === "orphan") {
    where.AND = [
      { profiles: { none: {} } },
      { applications_files: { none: {} } },
      { user_feedback_files: { none: {} } },
      { profile_exports: { none: {} } },
      { applications: { none: {} } },
    ];
  }

  const [files, total] = await Promise.all([
    db.query.files.findMany({
      where,
      orderBy: { created_on: "desc" },
      offset: (page - 1) * pageSize,
      limit: pageSize,
      with: {
        profiles: { select: { id: true, name: true } },
        applications_files: {
          select: {
            applications: {
              select: { id: true, jobs: { select: { title: true, company: true } } },
            },
          },
        },
        user_feedback_files: {
          select: { user_feedback: { select: { id: true, category: true } } },
        },
        profile_exports: { select: { id: true } },
      },
    }),
    db.files.count({ where }),
  ]);

  // Get import log entries for files that have them
  const fileIds = files.map((f) => f.id);
  const importLogs = fileIds.length
    ? await db.query.import_logs.findMany({
        where: { file_id: { in: fileIds } },
        select: {
          file_id: true,
          event: true,
          date_created: true,
          file_format: true,
          error: true,
          sections: true,
          user_email: true,
        },
        orderBy: { date_created: "desc" },
      })
    : [];

  const importLogMap = new Map<string, typeof importLogs>();
  for (const log of importLogs) {
    if (!log.file_id) continue;
    const existing = importLogMap.get(log.file_id) || [];
    existing.push(log);
    importLogMap.set(log.file_id, existing);
  }

  return {
    files: files.map((f) => ({
      ...f,
      filesize: f.filesize ? Number(f.filesize) : null,
      importLogs: importLogMap.get(f.id) || [],
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    typeFilter,
    usageFilter,
  };
};
