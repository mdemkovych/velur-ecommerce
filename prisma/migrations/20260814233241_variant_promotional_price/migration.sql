-- `price` becomes the ordinary price and `promotionalPrice` the discounted one,
-- which is the pair the shop actually talks about. `compareAtPrice` held the
-- same two numbers the other way round — `price` was the discounted figure and
-- `compareAtPrice` the original — so a row carrying a real sale has to have its
-- values **swapped**, not copied. Copying would quietly reprice the catalogue.
ALTER TABLE "product_variants" ADD COLUMN "promotionalPrice" INTEGER;

UPDATE "product_variants"
SET "promotionalPrice" = "price",
    "price" = "compareAtPrice"
WHERE "compareAtPrice" IS NOT NULL
  AND "compareAtPrice" > "price";

-- A `compareAtPrice` at or below `price` was never a valid sale — the admin
-- refused to save one — so those rows have nothing worth carrying over and are
-- left with no promotion at all.
ALTER TABLE "product_variants" DROP COLUMN "compareAtPrice";
