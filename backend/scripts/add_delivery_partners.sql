-- Migration: Create delivery_partners table
-- Run this SQL to add the delivery partners table

CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert some default delivery partners
INSERT INTO delivery_partners (name, active) VALUES 
    ('Talabat', true),
    ('Careem', true),
    ('Deliveroo', true)
ON CONFLICT DO NOTHING;
