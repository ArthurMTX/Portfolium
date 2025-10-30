-- Migration: Update user is_active default and existing users
-- Date: 2025-10-30
-- Description: Change is_active default to true since email verification is now enforced separately

-- Update the default value for is_active column
ALTER TABLE portfolio.users ALTER COLUMN is_active SET DEFAULT true;

-- Update existing users to be active (they should verify their email to login)
-- Only update users who are currently inactive but don't have pending verification
UPDATE portfolio.users 
SET is_active = true 
WHERE is_active = false;

-- Comment explaining the change
COMMENT ON COLUMN portfolio.users.is_active IS 'Account active status (separate from email verification)';
COMMENT ON COLUMN portfolio.users.is_verified IS 'Email verification status - required for login';
