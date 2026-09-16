-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_archivedAt_idx" ON "orders"("archivedAt");
