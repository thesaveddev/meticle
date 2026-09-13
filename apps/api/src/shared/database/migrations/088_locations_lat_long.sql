-- Add latitude and longitude to locations table
-- Used for person address geolocation in visit planning
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'latitude') THEN
    ALTER TABLE locations ADD COLUMN latitude DECIMAL(10, 7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'longitude') THEN
    ALTER TABLE locations ADD COLUMN longitude DECIMAL(10, 7);
  END IF;
END $$;
