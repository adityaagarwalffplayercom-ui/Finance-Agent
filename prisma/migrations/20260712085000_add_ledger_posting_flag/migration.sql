ALTER TABLE "ledger_entry"
ADD COLUMN "isPosting" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ledger_entry_userId_isPosting_direction_status_idx"
ON "ledger_entry"("userId", "isPosting", "direction", "status");
