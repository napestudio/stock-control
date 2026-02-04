-- Backfill displayName for existing ProductVariants
-- This script sets displayName from the name field or SKU if name is null

UPDATE "ProductVariant"
SET "displayName" = COALESCE(name, sku)
WHERE "displayName" IS NULL;
