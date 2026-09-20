CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  role VARCHAR(100),
  care_type VARCHAR(30),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  source VARCHAR(100) NOT NULL DEFAULT 'website',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(150),
  referrer VARCHAR(500),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('new', 'qualified', 'demo_booked', 'pilot', 'won', 'lost')),
  CONSTRAINT contact_submissions_care_type_check CHECK (care_type IS NULL OR care_type IN ('domiciliary', 'supported-living', 'both', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created
  ON contact_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
  ON contact_submissions(email);
