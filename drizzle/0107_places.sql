CREATE TABLE "places" (
	"id" integer PRIMARY KEY NOT NULL,
	"kind" varchar(16) NOT NULL,
	"name" varchar(200) NOT NULL,
	"label" varchar(400) NOT NULL,
	"country_code" varchar(2),
	"admin1" varchar(20),
	"countries" text[] NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"population" bigint DEFAULT 0 NOT NULL,
	"names" text[] NOT NULL,
	"tsv" "tsvector" NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_tsv_idx" ON "places" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "places_country_code_idx" ON "places" USING btree ("country_code");