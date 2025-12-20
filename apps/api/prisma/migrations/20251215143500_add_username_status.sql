-- Add username column
ALTER TABLE "User" ADD COLUMN "username" TEXT NOT NULL DEFAULT '';

-- Add role column update
ALTER TYPE "UserRole" RENAME VALUE 'TECHNICIAN' TO 'USER';
ALTER TYPE "UserRole" RENAME VALUE 'MANAGER' TO 'USER';
ALTER TYPE "UserRole" RENAME VALUE 'CASHIER' TO 'USER';

-- Add status column
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Create UserStatus enum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- Set default username for existing users
UPDATE "User" SET username =
  CASE
    WHEN email = 'admin@example.com' THEN 'admin'
    WHEN email = 'tech@example.com' THEN 'ahmad'
    WHEN email = 'siti@example.com' THEN 'siti'
    WHEN email = 'manager@example.com' THEN 'sarah'
    ELSE SPLIT_PART(email, '@', 1)
  END;

-- Update roles for existing users
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
UPDATE "User" SET role = 'USER' WHERE email != 'admin@example.com';

-- Set existing users as active
UPDATE "User" SET status = 'ACTIVE' WHERE email IN ('admin@example.com', 'tech@example.com', 'siti@example.com', 'manager@example.com');

-- Add unique constraint for username
ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username");