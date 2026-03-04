-- Set paul@synaxis.ai as admin
UPDATE user_profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'paul@synaxis.ai');
