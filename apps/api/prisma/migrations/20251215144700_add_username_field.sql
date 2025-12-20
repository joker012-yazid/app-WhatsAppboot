-- Add username field to User table
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Add role and status fields if they don't exist
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';

-- Update existing users
UPDATE "User" SET username =
  CASE
    WHEN email = 'admin@example.com' THEN 'admin'
    WHEN email = 'tech@example.com' THEN 'ahmad'
    WHEN email = 'siti@example.com' THEN 'siti'
    WHEN email = 'manager@example.com' THEN 'sarah'
    ELSE SPLIT_PART(email, '@', 1)
  END;

-- Set correct roles
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
UPDATE "User" SET role = 'USER' WHERE email != 'admin@example.com';

-- Set existing users as active
UPDATE "User" SET status = 'ACTIVE' WHERE email IN ('admin@example.com', 'tech@example.com', 'siti@example.com', 'manager@example.com');

-- Add unique constraint for username
ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username");

-- Update role enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'USER';