-- Contacts: user-to-user relationships (friend/contact system)
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "date_created" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "date_updated" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- Each pair of users can only have one contact request
CREATE UNIQUE INDEX "contacts_pair_unique" ON "contacts"("requester_id", "recipient_id");

-- Fast lookup for "my contacts" (both sent and received)
CREATE INDEX "idx_contacts_requester" ON "contacts"("requester_id");
CREATE INDEX "idx_contacts_recipient" ON "contacts"("recipient_id");

-- Foreign keys to users
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_requester_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_recipient_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Device shares: share an API key (device) with another user
CREATE TABLE "device_shares" (
    "id" SERIAL NOT NULL,
    "api_key_id" INTEGER NOT NULL,
    "shared_with" TEXT NOT NULL,
    "date_created" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_shares_pkey" PRIMARY KEY ("id")
);

-- Each device can only be shared once with each user
CREATE UNIQUE INDEX "device_shares_key_user_unique" ON "device_shares"("api_key_id", "shared_with");

CREATE INDEX "idx_device_shares_api_key" ON "device_shares"("api_key_id");
CREATE INDEX "idx_device_shares_shared_with" ON "device_shares"("shared_with");

-- Foreign keys
ALTER TABLE "device_shares"
  ADD CONSTRAINT "device_shares_api_key_fkey"
  FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "device_shares"
  ADD CONSTRAINT "device_shares_shared_with_fkey"
  FOREIGN KEY ("shared_with") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
