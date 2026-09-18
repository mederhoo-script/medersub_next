-- Public API plan prices use the same configurable tier structure as the
-- website, while retaining separate values for API customers.
UPDATE public.system_settings
SET value = jsonb_build_object(
  'public_api_data_profit_up_to_1gb', 10,
  'public_api_data_profit_up_to_3gb', 20,
  'public_api_data_profit_up_to_5gb', 30,
  'public_api_data_profit_up_to_10gb', 50,
  'public_api_data_profit_over_10gb', 100,
  'public_api_education_profit_per_pin', 20
) || value,
updated_at = now()
WHERE key = 'general';
