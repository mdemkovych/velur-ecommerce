-- A variant had room for one photograph, which was enough to swap the main
-- image when a shade was picked and not enough to photograph the shade. It now
-- carries its own gallery, and the product's own `media` remains the fallback
-- for variants that have none of their own.
ALTER TABLE "product_variants" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "product_variants"
SET "images" = ARRAY["image"]
WHERE "image" IS NOT NULL AND "image" <> '';

ALTER TABLE "product_variants" DROP COLUMN "image";
