-- Fit tag for clothes: slim / regular / loose. NULL = not tagged (silhouette stays neutral).
-- Apply: Supabase dashboard -> SQL Editor (new query, paste only this).
ALTER TABLE items ADD COLUMN IF NOT EXISTS fit text DEFAULT NULL;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_fit_check;
ALTER TABLE items ADD CONSTRAINT items_fit_check CHECK (fit IS NULL OR fit IN ('slim', 'regular', 'loose'));

-- Revert:
-- ALTER TABLE items DROP CONSTRAINT IF EXISTS items_fit_check;
-- ALTER TABLE items DROP COLUMN fit;
