-- Remove the retired percentage and blanket public API markup fields. Plan
-- tier settings are added by the next migration.
UPDATE public.system_settings
SET value = value - 'public_api_markup_percentage' - 'public_api_markup',
    updated_at = now()
WHERE key = 'general';
