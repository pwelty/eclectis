-- Add is_admin flag to user_profiles for admin area access control
ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
