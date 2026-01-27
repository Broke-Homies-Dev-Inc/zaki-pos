-- KOT Devices and Kitchen Stations Migration
-- This creates tables for managing KOT (Kitchen Order Ticket) devices
-- and kitchen stations with their device mappings

-- KOT Devices table - stores printer/display devices for kitchen tickets
CREATE TABLE IF NOT EXISTS kot_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    port INTEGER DEFAULT 9100,
    device_type VARCHAR(50) DEFAULT 'thermal_printer',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kitchen Stations table - represents kitchen work areas (e.g., Grill, Fry, Salad)
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction table linking stations to KOT devices (many-to-many)
CREATE TABLE IF NOT EXISTS kitchen_station_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES kot_devices(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(station_id, device_id)
);

-- Add station_id column to menu_items table
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES kitchen_stations(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_items_station_id ON menu_items(station_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_station_devices_station ON kitchen_station_devices(station_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_station_devices_device ON kitchen_station_devices(device_id);
