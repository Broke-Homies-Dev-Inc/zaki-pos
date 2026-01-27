
-- Create pos_sessions table
CREATE TABLE IF NOT EXISTS pos_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'closed')),
    log_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
    log_out_time TIMESTAMP,
    ip_address VARCHAR(45)
);

-- Index for faster lookups on active sessions
CREATE INDEX IF NOT EXISTS idx_pos_sessions_active ON pos_sessions(status) WHERE status = 'active';
