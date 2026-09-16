-- Block 04 stops being an override and becomes a plain per-product field.
--
-- Written by hand rather than generated: Prisma's diff drops the old column and
-- adds a new one, which would delete the packaging copy the two gift sets carry.
-- A rename keeps it.

ALTER TABLE "products" RENAME COLUMN "packagingOverride" TO "packaging";

-- Everything that relied on the hidden fallback gets that text written down, so
-- what the page shows is what the row says and the admin panel can edit it.
UPDATE "products"
   SET "packaging" = '• Delivery across Ukraine by Nova Poshta, to a branch, a parcel locker or by courier. The carrier''s own tariff, settled on collection.
• Dispatched within 1–3 working days of the order being confirmed.
• Every item ships in VELUR gift packaging.'
 WHERE "packaging" IS NULL OR btrim("packaging") = '';

ALTER TABLE "products" ALTER COLUMN "packaging" SET DEFAULT '';
ALTER TABLE "products" ALTER COLUMN "packaging" SET NOT NULL;
