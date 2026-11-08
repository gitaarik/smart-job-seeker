-- The shared media presets: what each platform asks for in an image slot
-- (planning/MEDIA-LIBRARY.md, decision 4).
--
-- Every number here was read off the platform's own help or developer page on
-- 2026-11-08, and each row says which one in source_url. Where a page states
-- a minimum and no recommended size, the row picks a size above the minimum
-- and its note says so; where a page says nothing about how the picture is
-- shown (most say nothing about the circle), the note says that too. A
-- covered zone LinkedIn and X do not publish is drawn as an approximation and
-- labelled as one. "MB" is read as 1,000,000 bytes, the reading no platform
-- can refuse.
--
-- Data, not schema, for the reason 0010 gives: deploy runs migrations and
-- nothing else. Each insert is a no-op where the key already exists, so a
-- preset someone corrected by hand is left alone.
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'linkedin-photo', 'LinkedIn', 'Profile photo', 'photo', 400, 400, '["jpeg","png"]'::jsonb, 8000000, 'circle', NULL,
       '400x400 is the smallest LinkedIn takes; it accepts up to 7680x4320. PNG or JPG, no GIF. Shown as a circle on profiles, which the help page does not say.',
       'https://www.linkedin.com/help/linkedin/answer/a549049', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'linkedin-photo' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'linkedin-background', 'LinkedIn', 'Background', 'banner', 1584, 396, '["jpeg","png"]'::jsonb, 8000000, 'none',
       '[{"kind":"covered","x":0,"y":150,"w":420,"h":246,"label":"Your profile photo sits over the lower left. Roughly here: LinkedIn says it covers the background, not where."}]'::jsonb,
       'LinkedIn now calls it the cover image. Recommended size, under 8 MB. How much shows changes with the window size.',
       'https://www.linkedin.com/help/linkedin/answer/a566232', '2026-11-08', 2, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'linkedin-background' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'x-photo', 'X', 'Profile photo', 'photo', 400, 400, '["jpeg","png"]'::jsonb, 2000000, 'circle', NULL,
       'Recommended size, under 2 MB; JPEG, PNG or a still GIF. Shown as a circle, which the help page does not say. Read from the page''s 2026-10-07 archive copy: help.x.com refuses scripted reads.',
       'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'x-photo' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'x-header', 'X', 'Header', 'banner', 1500, 500, '["jpeg","png"]'::jsonb, NULL, 'none',
       '[{"kind":"safe","x":0,"y":60,"w":1500,"h":380,"label":"Some screens cut 60 pixels off the top and the bottom."},{"kind":"covered","x":0,"y":380,"w":330,"h":120,"label":"Your profile photo overlaps the lower left. Roughly here: X does not say where."}]'::jsonb,
       'Recommended size. No file size limit is stated for headers. Read from the page''s 2026-09-25 archive copy: help.x.com refuses scripted reads.',
       'https://help.x.com/en/managing-your-account/how-to-customize-your-profile', '2026-11-08', 2, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'x-header' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'github-avatar', 'GitHub', 'Profile picture', 'photo', 500, 500, '["png","jpeg"]'::jsonb, 999999, 'circle', NULL,
       'About 500x500 is recommended; it must be under 1 MB and smaller than 3000x3000. PNG, JPG or GIF. A circle for people, per GitHub''s design system (primer.style).',
       'https://docs.github.com/en/account-and-profile/reference/profile-reference', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'github-avatar' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'github-social-preview', 'GitHub', 'Repository social preview', 'banner', 1280, 640, '["png","jpeg"]'::jsonb, 999999, 'none', NULL,
       '1280x640 for best display, at least 640x320, under 1 MB. PNG with transparency is supported.',
       'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview', '2026-11-08', 2, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'github-social-preview' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'upwork-photo', 'Upwork', 'Profile photo', 'photo', 1000, 1000, '["jpeg","png"]'::jsonb, 5000000, 'circle', NULL,
       'Upwork takes 250x250 to 4000x4000, JPEG or PNG, up to 5 MB, and no GIF; 1000x1000 is this preset''s choice, not Upwork''s. Shown as a circle, which the guide does not say. The numbers are on Upwork''s own photo guide (archive copy of 2025-08-19), not in its help center.',
       'https://www.upwork.com/resources/how-to-guide-perfect-profile-picture', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'upwork-photo' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'malt-photo', 'Malt', 'Profile photo', 'photo', 1000, 1000, '["jpeg","png"]'::jsonb, 5000000, 'none', NULL,
       'Malt asks for 500 px minimum, JPG or PNG, up to 5 MB; 1000x1000 is this preset''s choice. The numbers are in the profile picture section of its Malt Strategy article.',
       'https://help.malt.com/hc/en-150/articles/29504319311250-How-do-I-apply-to-Malt-Strategy', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'malt-photo' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'gravatar-avatar', 'Gravatar', 'Avatar', 'photo', 2048, 2048, '["jpeg","png"]'::jsonb, 10000000, 'none', NULL,
       'Must be square. Gravatar serves it at any size up to 2048x2048, so that is the largest worth uploading; under 10 MB. The sites that show it decide its shape.',
       'https://support.gravatar.com/avatars/', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'gravatar-avatar' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'og-image', 'Open Graph', 'Link preview', 'banner', 1200, 630, '["jpeg","png"]'::jsonb, 5000000, 'none', NULL,
       'The picture a shared link shows. Facebook recommends at least 1200x630 (1.91:1) and allows 8 MB; LinkedIn asks for at least 1200x627 and 5 MB, so 5 MB is the limit here.',
       'https://developers.facebook.com/docs/sharing/webmasters/images', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'og-image' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'favicon-16', 'Favicon', 'Browser tab, 16px', 'icon', 16, 16, '["png"]'::jsonb, NULL, 'none', NULL,
       'The 16-pixel square icon a browser tab shows.',
       'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Webpage_metadata#adding_custom_icons_to_your_site', '2026-11-08', 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'favicon-16' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'favicon-96', 'Favicon', 'Search results, 96px', 'icon', 96, 96, '["png"]'::jsonb, NULL, 'none', NULL,
       'Google Search shows a site''s favicon beside its results and asks for a square larger than 48x48; 96 is a multiple of 48. SVG is not on its list.',
       'https://developers.google.com/search/docs/appearance/favicon-in-search', '2026-11-08', 2, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'favicon-96' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'apple-touch-icon', 'Favicon', 'Apple touch icon, 180px', 'icon', 180, 180, '["png"]'::jsonb, NULL, 'rounded', NULL,
       'What an iPhone shows for a site saved to its home screen: a 180x180 PNG named apple-touch-icon.png. The phone rounds the corners.',
       'https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html', '2026-11-08', 3, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'apple-touch-icon' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'manifest-192', 'Favicon', 'App icon, 192px', 'icon', 192, 192, '["png"]'::jsonb, NULL, 'none',
       '[{"kind":"safe","x":42,"y":42,"w":108,"h":108,"label":"Inside the circle a maskable icon keeps (80% across); this is the square that fits in it."}]'::jsonb,
       'A web app manifest needs a 192x192 and a 512x512 icon (Chromium).',
       'https://web.dev/articles/add-manifest', '2026-11-08', 4, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'manifest-192' AND "profile_id" IS NULL);
--> statement-breakpoint
INSERT INTO "media_presets" ("key", "platform", "slot", "kind", "width", "height", "formats", "max_bytes", "mask", "safe_zone", "note", "source_url", "verified_on", "sort", "date_created")
SELECT 'manifest-512', 'Favicon', 'App icon, 512px', 'icon', 512, 512, '["png"]'::jsonb, NULL, 'none',
       '[{"kind":"safe","x":111,"y":111,"w":290,"h":290,"label":"Inside the circle a maskable icon keeps (80% across); this is the square that fits in it."}]'::jsonb,
       'The one size to make if only one: 512x512. Maskable icons keep a centred circle 80% across and may lose the edges.',
       'https://web.dev/articles/maskable-icon', '2026-11-08', 5, now()
WHERE NOT EXISTS (SELECT 1 FROM "media_presets" WHERE "key" = 'manifest-512' AND "profile_id" IS NULL);
