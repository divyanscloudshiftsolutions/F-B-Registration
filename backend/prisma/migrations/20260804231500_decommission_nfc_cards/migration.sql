-- AlterTable
ALTER TABLE "tokens" ALTER COLUMN "delivery_mode" SET DEFAULT 'EMAIL_QR';

-- DropTable
DROP TABLE "cards" CASCADE;

-- Step 1: Temporarily convert column to text
ALTER TABLE "tokens" ALTER COLUMN "activation_method" TYPE text;

-- Step 2: Drop the old enum type
DROP TYPE "ActivationMethod";

-- Step 3: Create the new enum type
CREATE TYPE "ActivationMethod" AS ENUM ('EMAIL_QR');

-- Step 4: Convert column back to the enum, mapping any existing 'NFC' values to NULL
UPDATE "tokens" SET "activation_method" = NULL WHERE "activation_method" = 'NFC';
ALTER TABLE "tokens" ALTER COLUMN "activation_method" TYPE "ActivationMethod" USING ("activation_method"::"ActivationMethod");
