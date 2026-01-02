-- Add 'is_blocked' to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;

-- Create System Settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamp DEFAULT now()
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES 
('general', '{"maintenance_mode": false, "global_markup_percentage": 0}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS for settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Admins can view/edit settings
CREATE POLICY "Admins can manage settings" ON system_settings
  USING (exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN'));
