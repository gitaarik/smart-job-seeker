CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'draft',
    "sort" INTEGER,
    "date_created" TIMESTAMPTZ(6),
    "date_updated" TIMESTAMPTZ(6),
    "name" VARCHAR(255) NOT NULL,
    "issuer" VARCHAR(255),
    "date" DATE,
    "url" VARCHAR(255),
    "profile" INTEGER NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_certificates_profile" ON "certificates"("profile");

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_profile_foreign"
    FOREIGN KEY ("profile") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
