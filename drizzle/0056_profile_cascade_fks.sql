ALTER TABLE "applications" DROP CONSTRAINT "applications_profile_foreign";
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Reap profiles whose owner no longer exists before validating the new FK,
-- else ADD CONSTRAINT fails on the orphaned rows. These point at a deleted
-- user (user_id set but absent from users) and are unreachable/unusable;
-- intentionally-ownerless profiles (user_id IS NULL) are left alone. Runs
-- after the applications cascade above so the delete can clean their subtrees.
DELETE FROM "profiles" p
  WHERE p.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = p.user_id);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
