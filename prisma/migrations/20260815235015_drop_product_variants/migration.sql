-- Collapse product variants into the product itself.
--
-- Variants modelled shades and volumes, and the shop turned out not to sell
-- either: every product is one thing with one price and one stock figure. The
-- data agreed — at the time of writing, no product still in the catalogue had
-- more than one variant.
--
-- Order history does not depend on this table. `order_items` freezes `nameUk`,
-- `price` and `image` at the moment of purchase, so the lines stay readable
-- with the variant rows gone; only the foreign key is dropped.

-- 1. The figures move onto the product.
ALTER TABLE "products" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "promotionalPrice" INTEGER;
ALTER TABLE "products" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

-- 2. Copy from the variant that the storefront would have opened on: the
--    default one, else the first by position. `DISTINCT ON` picks exactly one
--    row per product under that ordering.
UPDATE "products" p
SET "price"            = v."price",
    "promotionalPrice" = v."promotionalPrice",
    "stock"            = v."stock"
FROM (
  SELECT DISTINCT ON ("productId")
         "productId", "price", "promotionalPrice", "stock", "images"
  FROM "product_variants"
  ORDER BY "productId", "isDefault" DESC, "position" ASC, "createdAt" ASC
) v
WHERE p."id" = v."productId";

-- 3. A variant's own photographs become the product's, but only where the
--    product had none of its own — otherwise the shoot the manager chose for
--    the product would be replaced by a shade's crop.
UPDATE "products" p
SET "media" = v."images"
FROM (
  SELECT DISTINCT ON ("productId") "productId", "images"
  FROM "product_variants"
  ORDER BY "productId", "isDefault" DESC, "position" ASC, "createdAt" ASC
) v
WHERE p."id" = v."productId"
  AND COALESCE(array_length(p."media", 1), 0) = 0
  AND COALESCE(array_length(v."images", 1), 0) > 0;

-- 4. Order lines keep their frozen figures and lose the reference.
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_variantId_fkey";
ALTER TABLE "order_items" DROP COLUMN "variantId";

-- 5. The table itself.
DROP TABLE "product_variants";
