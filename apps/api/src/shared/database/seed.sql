-- Seed Organizations
INSERT INTO organizations (name) VALUES ('HealthCare Plus'), ('Care Angels') ON CONFLICT DO NOTHING;

-- Seed Admin User (password: Password123)
INSERT INTO users (email, password_hash, role, status) 
VALUES ('admin@meticlecare.com', '$2a$10$UszwPdZwPdWbkEeTj8PzduOCGfbCynXlUlUiwxoVW18SwpPaOWVVe', 'SUPER_ADMIN', 'active') 
ON CONFLICT (email) DO NOTHING;
