-- `colorAlias` was the shade's own URL-safe name. A volume needs exactly the
-- same thing — `250-ml` in `?volume=250-ml` — and a product varies along one
-- axis, so one column serves both rather than two that could never be filled at
-- the same time. Renaming keeps every value that was already there.
ALTER TABLE "product_variants" RENAME COLUMN "colorAlias" TO "alias";
