-- Add email configuration table
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    enable_email BOOLEAN DEFAULT false,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    smtp_tls BOOLEAN DEFAULT true,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    frontend_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- No need to insert default values - the ensure_email_config() function in app startup
-- will initialize the config table with values from environment variables

-- Add daily_report_enabled column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'daily_report_enabled'
    ) THEN
        ALTER TABLE users ADD COLUMN daily_report_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

