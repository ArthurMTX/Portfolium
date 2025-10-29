-- Add email configuration table
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    enable_email BOOLEAN DEFAULT false,
    smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    smtp_tls BOOLEAN DEFAULT true,
    from_email VARCHAR(255) DEFAULT 'noreply@example.com',
    from_name VARCHAR(255) DEFAULT 'Portfolium',
    frontend_url VARCHAR(255) DEFAULT 'http://localhost:5173',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration if table is empty
INSERT INTO config (id, enable_email, smtp_host, smtp_port, smtp_tls, from_email, from_name, frontend_url)
SELECT 1, false, 'smtp.gmail.com', 587, true, 'noreply@example.com', 'Portfolium', 'http://localhost:5173'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE id = 1);

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
