-- Update the legacy 9mobile service rows to T2mobile without altering the table schema or RLS setup.
-- This is a safe follow-up migration intended for existing databases.

UPDATE services
SET id = CASE
    WHEN id = '9mobile-airtime' THEN 't2mobile-airtime'
    WHEN id = '9mobile-data' THEN 't2mobile-data'
    ELSE id
END,
    name = CASE
    WHEN id = '9mobile-airtime' THEN 'T2mobile Airtime'
    WHEN id = '9mobile-data' THEN 'T2mobile Data'
    ELSE name
END
WHERE id IN ('9mobile-airtime', '9mobile-data');

-- Make sure the new IDs are present for fresh installs that never received the old seed values.
INSERT INTO services (id, name, type, is_active)
VALUES
  ('t2mobile-airtime', 'T2mobile Airtime', 'AIRTIME', true),
  ('t2mobile-data', 'T2mobile Data', 'DATA', true)
ON CONFLICT (id) DO NOTHING;
