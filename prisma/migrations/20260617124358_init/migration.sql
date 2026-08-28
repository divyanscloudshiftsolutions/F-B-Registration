-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('MANUAL', 'QR_SCAN', 'CHECKOUT', 'SESSION_EXPIRED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'CLOSED', 'CANCELLED', 'EXPIRED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "ActivationMethod" AS ENUM ('EMAIL_QR', 'NFC');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('USER_CANCELLED', 'PAYMENT_CANCELLED', 'DUPLICATE_CHECKIN', 'SESSION_RESTARTED', 'OTHER');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_visit" TIMESTAMP(3),
    "total_visits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_per_person" DECIMAL(10,2) NOT NULL,
    "base_time_minutes" INTEGER NOT NULL,
    "redemptions_per_person" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "place_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "table_number" TEXT NOT NULL,
    "place_type_id" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'available',
    "current_token_id" TEXT,
    "occupied_since" TIMESTAMP(3),
    "last_assigned_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "maintenance_start" TIMESTAMP(3),
    "maintenance_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "token_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "persons_count" INTEGER NOT NULL,
    "place_type_id" TEXT NOT NULL,
    "table_id" TEXT,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "payment_verified" BOOLEAN NOT NULL DEFAULT false,
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3) NOT NULL,
    "total_redemptions_allowed" INTEGER NOT NULL,
    "redemptions_used" INTEGER NOT NULL DEFAULT 0,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_by" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "close_reason" "CloseReason",
    "delivery_mode" TEXT NOT NULL DEFAULT 'NFC_CARD',
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "email_delivery_status" TEXT,
    "activated_at" TIMESTAMP(3),
    "activated_by" TEXT,
    "activation_method" "ActivationMethod",
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancel_reason" "CancelReason",
    "payment_confirmed_at" TIMESTAMP(3),
    "payment_confirmed_by" TEXT,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "redemption_sequence" INTEGER NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bartender_id" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "nfc_uid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "assigned_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "write_cycles" INTEGER NOT NULL DEFAULT 0,
    "last_written_at" TIMESTAMP(3),
    "current_token_id" TEXT,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_extensions" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "extra_minutes" INTEGER NOT NULL,
    "additional_amount" DECIMAL(10,2) NOT NULL,
    "approved_by" TEXT NOT NULL,
    "extended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "new_end_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_occupancy_logs" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "occupied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vacated_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,

    CONSTRAINT "table_occupancy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_logs" (
    "id" TEXT NOT NULL,
    "place_type_id" TEXT NOT NULL,
    "old_rate" DECIMAL(10,2) NOT NULL,
    "new_rate" DECIMAL(10,2) NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "conflict_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_change_logs" (
    "id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "old_role" TEXT NOT NULL,
    "new_role" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_number_key" ON "customers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "place_types_name_key" ON "place_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tables_table_number_place_type_id_key" ON "tables"("table_number", "place_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_number_key" ON "tokens"("token_number");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_token_id_redemption_sequence_key" ON "redemptions"("token_id", "redemption_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "cards_nfc_uid_key" ON "cards"("nfc_uid");

-- CreateIndex
CREATE UNIQUE INDEX "cards_current_token_id_key" ON "cards"("current_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_operation_id_key" ON "sync_logs"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_config_key_key" ON "system_configs"("config_key");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_place_type_id_fkey" FOREIGN KEY ("place_type_id") REFERENCES "place_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_place_type_id_fkey" FOREIGN KEY ("place_type_id") REFERENCES "place_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_bartender_id_fkey" FOREIGN KEY ("bartender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_current_token_id_fkey" FOREIGN KEY ("current_token_id") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_extensions" ADD CONSTRAINT "token_extensions_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_extensions" ADD CONSTRAINT "token_extensions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_occupancy_logs" ADD CONSTRAINT "table_occupancy_logs_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_occupancy_logs" ADD CONSTRAINT "table_occupancy_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_logs" ADD CONSTRAINT "rate_logs_place_type_id_fkey" FOREIGN KEY ("place_type_id") REFERENCES "place_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_logs" ADD CONSTRAINT "rate_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
