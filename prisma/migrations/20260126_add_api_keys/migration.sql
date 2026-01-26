-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "profile" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "date_created" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "last_used" TIMESTAMPTZ(6),
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_hash" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_profile" ON "api_keys"("profile");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_profile_foreign" FOREIGN KEY ("profile") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
