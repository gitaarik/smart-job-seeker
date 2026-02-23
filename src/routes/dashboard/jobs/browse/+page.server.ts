import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  // Parse query parameters
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || "";
  const status = url.searchParams.get("status") || "";
  const sortBy = url.searchParams.get("sort") || "date_created";
  const sortOrder = url.searchParams.get("order") || "desc";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { office_location: { contains: search, mode: "insensitive" } },
      { job_description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (platform) {
    where.job_platform = parseInt(platform);
  }

  if (status) {
    where.status = status;
  }

  // Get jobs with pagination
  const [jobs, totalCount] = await Promise.all([
    db.jobs.findMany({
      where,
      include: {
        job_platforms: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    db.jobs.count({ where }),
  ]);

  // Get all platforms for filter dropdown
  const platforms = await db.job_platforms.findMany({
    where: { status: "published" },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    jobs,
    platforms,
    totalCount,
    currentPage: page,
    totalPages,
    filters: {
      search,
      platform,
      status,
      sortBy,
      sortOrder,
    },
  };
};
