-- Create Services table for local management (overrides or extends provider)
CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY, -- e.g., 'mtn-data', 'airtel-airtime'
  name text NOT NULL,
  type text NOT NULL, -- 'AIRTIME', 'DATA', 'CABLE'
  provider_id text, -- ID from Inlomax
  is_active boolean DEFAULT true,
  image_url text,
  markup numeric DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Seed defaults
INSERT INTO services (id, name, type, is_active) VALUES
('mtn-airtime', 'MTN Airtime', 'AIRTIME', true),
('glo-airtime', 'Glo Airtime', 'AIRTIME', true),
('airtel-airtime', 'Airtel Airtime', 'AIRTIME', true),
('9mobile-airtime', '9mobile Airtime', 'AIRTIME', true),
('mtn-data', 'MTN Data', 'DATA', true),
('glo-data', 'Glo Data', 'DATA', true),
('airtel-data', 'Airtel Data', 'DATA', true),
('9mobile-data', '9mobile Data', 'DATA', true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage services" ON services USING (exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN'));
