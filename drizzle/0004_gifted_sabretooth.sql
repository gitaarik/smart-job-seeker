ALTER TABLE "api_keys" RENAME COLUMN "key_plain" TO "key_encrypted";--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "key_encrypted" SET DATA TYPE text;