-- Ride sharing: two carers heading to nearby clients can share a ride
-- and split the mileage between them.

-- Add ride share columns to homecare_visits
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS ride_share_id UUID;
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS ride_share_split_pct NUMERIC(5,2) DEFAULT 100.00;
-- ride_share_split_pct: percentage of mileage this carer claims (100 = full, 50 = half)

-- Ride share requests table
CREATE TABLE IF NOT EXISTS ride_share_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  target_visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  responded_by UUID REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ride_share_requests_org ON ride_share_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ride_share_requests_visit ON ride_share_requests(visit_id);
CREATE INDEX IF NOT EXISTS idx_ride_share_requests_target ON ride_share_requests(target_visit_id);

-- Allow ride share requests to be queried by status
CREATE INDEX IF NOT EXISTS idx_ride_share_requests_status ON ride_share_requests(status);
