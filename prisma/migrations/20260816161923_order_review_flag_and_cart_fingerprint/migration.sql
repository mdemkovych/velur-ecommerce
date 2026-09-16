-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cartFingerprint" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "orders_phone_status_cartFingerprint_idx" ON "orders"("phone", "status", "cartFingerprint");
