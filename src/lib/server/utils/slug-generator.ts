import { dbDirect as db } from "$lib/db";

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureUniqueSlug(
  baseSlug: string,
  excludeProfileId?: number,
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await db.profiles.findFirst({
      where: {
        slug,
        ...(excludeProfileId ? { id: { not: excludeProfileId } } : {}),
      },
    });

    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function generateUniqueSlug(
  name: string | null,
  profileId?: number,
): Promise<string> {
  if (!name?.trim()) {
    return ensureUniqueSlug(
      profileId ? `profile-${profileId}` : "profile",
      profileId,
    );
  }

  let baseSlug = generateSlug(name);
  if (!baseSlug) {
    return ensureUniqueSlug(
      profileId ? `profile-${profileId}` : "profile",
      profileId,
    );
  }

  if (baseSlug.length > 240) {
    baseSlug = baseSlug.substring(0, 240);
  }

  return ensureUniqueSlug(baseSlug, profileId);
}
