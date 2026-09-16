-- DropIndex
DROP INDEX "orders_status_idx";

-- CreateIndex
CREATE INDEX "orders_status_expiresAt_idx" ON "orders"("status", "expiresAt");
