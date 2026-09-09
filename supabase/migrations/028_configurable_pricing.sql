-- Keep the original selling-profit values as defaults, while making every
-- hard-coded data and education profit configurable by an administrator.
INSERT INTO public.system_settings (key, value)
VALUES (
  'general',
  '{
    "maintenance_mode": false,
    "global_markup_percentage": 0,
    "markup": 0,
    "public_api_markup_percentage": 0,
    "data_profit_up_to_1gb": 10,
    "data_profit_up_to_3gb": 20,
    "data_profit_up_to_5gb": 30,
    "data_profit_up_to_10gb": 50,
    "data_profit_over_10gb": 100,
    "education_profit_per_pin": 20
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value || public.system_settings.value;
