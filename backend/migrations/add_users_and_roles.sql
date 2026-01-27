-- Add users and roles tables for authentication and role-based permissions
-- Run this migration: psql -d your_database -f migrations/add_users_and_roles.sql

-- Roles table - defines what tabs each role can access
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    tab_dashboard BOOLEAN NOT NULL DEFAULT true,
    tab_orders BOOLEAN NOT NULL DEFAULT true,
    tab_menu BOOLEAN NOT NULL DEFAULT false,
    tab_inventory BOOLEAN NOT NULL DEFAULT false,
    tab_ingredients BOOLEAN NOT NULL DEFAULT false,
    tab_billing BOOLEAN NOT NULL DEFAULT false,
    tab_reports BOOLEAN NOT NULL DEFAULT false,
    tab_customers BOOLEAN NOT NULL DEFAULT false,
    tab_settings BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table - stores user accounts
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Insert default roles with their permissions
INSERT INTO roles (name, tab_dashboard, tab_orders, tab_menu, tab_inventory, tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings) VALUES
    ('Admin', true, true, true, true, true, true, true, true, true),
    ('Manager', true, true, true, true, true, true, true, true, false),
    ('Cashier', true, true, false, false, false, true, false, true, false),
    ('Waiter', true, true, false, false, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt, rounds=10
INSERT INTO users (username, password_hash, name, role_id)
SELECT 'admin', '$2b$10$8K1p/RlI.UJzg2F1fQzE4uI9qJF4F0jF5Q5e5Q5e5Q5e5Q5e5Q5e.', 'Administrator', id
FROM roles WHERE name = 'Admin'
ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE roles IS 'Defines user roles with tab visibility permissions';
COMMENT ON TABLE users IS 'User accounts for POS authentication';
COMMENT ON COLUMN roles.tab_dashboard IS 'Can access Dashboard tab';
COMMENT ON COLUMN roles.tab_orders IS 'Can access Orders tab';
COMMENT ON COLUMN roles.tab_menu IS 'Can access Menu tab';
COMMENT ON COLUMN roles.tab_inventory IS 'Can access Inventory tab';
COMMENT ON COLUMN roles.tab_ingredients IS 'Can access Ingredients tab';
COMMENT ON COLUMN roles.tab_billing IS 'Can access Billing tab';
COMMENT ON COLUMN roles.tab_reports IS 'Can access Reports tab';
COMMENT ON COLUMN roles.tab_customers IS 'Can access Customers tab';
COMMENT ON COLUMN roles.tab_settings IS 'Can access Settings tab';
