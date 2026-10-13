-- Light jacket upper limit (°C). NULL = app default (cold threshold + 5).
-- Apply: Supabase dashboard -> SQL Editor.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS light_outerwear_max_pref integer DEFAULT NULL;

-- Revert:
-- ALTER TABLE profiles DROP COLUMN light_outerwear_max_pref;
