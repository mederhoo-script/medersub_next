-- Public API service prices use a fixed naira profit, just like the main
-- platform pricing, rather than a percentage markup.
UPDATE public.system_settings
SET value = jsonb_set(value - 'public_api_markup_percentage', '{public_api_markup}', COALESCE(value->'public_api_markup', '0'::jsonb), true),
    updated_at = now()
WHERE key = 'general';
