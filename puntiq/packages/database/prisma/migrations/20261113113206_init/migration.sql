-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "platform_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "email_frequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "building_type" AS ENUM ('APARTMENT_COMPLEX', 'SINGLE_FAMILY', 'MIXED_USE', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "heritage_status" AS ENUM ('NONE', 'RIJKSMONUMENT', 'GEMEENTELIJK_MONUMENT', 'BESCHERMD_STADSGEZICHT');

-- CreateEnum
CREATE TYPE "energy_label" AS ENUM ('A4_PLUS', 'A3_PLUS', 'A2_PLUS', 'A1_PLUS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'NONE');

-- CreateEnum
CREATE TYPE "unit_type" AS ENUM ('APARTMENT', 'SINGLE_FAMILY_HOUSE', 'STUDIO', 'ROOM', 'COMMERCIAL', 'PARKING', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "unit_status" AS ENUM ('AVAILABLE', 'RENTED', 'UNDER_MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "rental_segment" AS ENUM ('SOCIAL', 'MIDDLE', 'FREE');

-- CreateEnum
CREATE TYPE "wws_scheme" AS ENUM ('WWS', 'WWSO');

-- CreateEnum
CREATE TYPE "tenant_type" AS ENUM ('PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('PROSPECT', 'ACTIVE', 'FORMER');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('FIXED_TERM', 'INDEFINITE');

-- CreateEnum
CREATE TYPE "rent_change_reason" AS ENUM ('INDEXATION', 'AGREEMENT', 'CORRECTION', 'REDUCTION');

-- CreateEnum
CREATE TYPE "maintenance_category" AS ENUM ('PLUMBING', 'ELECTRICAL', 'HEATING', 'ROOF', 'EXTERIOR', 'INTERIOR', 'APPLIANCES', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "maintenance_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "document_category" AS ENUM ('CONTRACT', 'WWS', 'MAINTENANCE', 'FINANCIAL', 'IDENTITY', 'PHOTO', 'CORRESPONDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "invoice_kind" AS ENUM ('RENT', 'DEPOSIT', 'SERVICE_CHARGE_SETTLEMENT', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "invoice_line_type" AS ENUM ('RENT', 'SERVICE_CHARGES', 'DEPOSIT', 'MAINTENANCE', 'UTILITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('BANK_TRANSFER', 'DIRECT_DEBIT', 'IDEAL', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('MAINTENANCE', 'INSURANCE', 'TAXES', 'UTILITIES', 'MANAGEMENT', 'FINANCING', 'OTHER');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('CONTRACT_EXPIRING', 'CONTRACT_EXPIRED', 'RENT_INDEXATION', 'MAINTENANCE_URGENT', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'SYSTEM');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "legal_name" VARCHAR(200),
    "kvk_number" CHAR(8),
    "vat_number" VARCHAR(20),
    "iban" VARCHAR(34),
    "email" CITEXT,
    "phone" VARCHAR(30),
    "street" VARCHAR(160),
    "house_number" VARCHAR(20),
    "postcode" VARCHAR(10),
    "city" VARCHAR(100),
    "country" CHAR(2) NOT NULL DEFAULT 'NL',
    "logo_key" VARCHAR(300),
    "default_rent_indexation" DECIMAL(5,2) NOT NULL DEFAULT 3.5,
    "default_payment_term_days" SMALLINT NOT NULL DEFAULT 14,
    "invoice_prefix" VARCHAR(10) NOT NULL DEFAULT 'F',
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "username" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "platform_role" "platform_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "phone" VARCHAR(30),
    "job_title" VARCHAR(100),
    "avatar_key" VARCHAR(300),
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "email_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "active_company_id" UUID,
    "theme" "theme" NOT NULL DEFAULT 'LIGHT',
    "compact" BOOLEAN NOT NULL DEFAULT false,
    "reduced_motion" BOOLEAN NOT NULL DEFAULT false,
    "landing_page" VARCHAR(30) NOT NULL DEFAULT 'dashboard',
    "notify_contracts" BOOLEAN NOT NULL DEFAULT true,
    "notify_indexation" BOOLEAN NOT NULL DEFAULT true,
    "notify_maintenance" BOOLEAN NOT NULL DEFAULT true,
    "notify_payments" BOOLEAN NOT NULL DEFAULT true,
    "contract_reminder_days" SMALLINT NOT NULL DEFAULT 90,
    "payment_reminder_days" SMALLINT NOT NULL DEFAULT 7,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "email_frequency" "email_frequency" NOT NULL DEFAULT 'WEEKLY',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL DEFAULT 'MANAGER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_invitations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "membership_role" NOT NULL DEFAULT 'MANAGER',
    "token_hash" CHAR(64) NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_agent" VARCHAR(400),
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "building_type" "building_type" NOT NULL DEFAULT 'APARTMENT_COMPLEX',
    "street" VARCHAR(160) NOT NULL,
    "house_number" VARCHAR(20),
    "postcode" VARCHAR(10) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'NL',
    "year_built" SMALLINT,
    "energy_label" "energy_label",
    "heritage_status" "heritage_status" NOT NULL DEFAULT 'NONE',
    "cadastral_reference" VARCHAR(40),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "unit_type" "unit_type" NOT NULL DEFAULT 'APARTMENT',
    "status" "unit_status" NOT NULL DEFAULT 'AVAILABLE',
    "street" VARCHAR(160) NOT NULL,
    "house_number" INTEGER NOT NULL,
    "house_number_addition" VARCHAR(10) NOT NULL DEFAULT '',
    "postcode" VARCHAR(10) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "floor" VARCHAR(20),
    "living_area" DECIMAL(8,2),
    "rooms" SMALLINT,
    "bedrooms" SMALLINT,
    "year_built" SMALLINT,
    "energy_label" "energy_label",
    "woz_value" DECIMAL(12,2),
    "woz_reference_date" DATE,
    "wws_points" DECIMAL(7,2),
    "max_rent" DECIMAL(10,2),
    "rental_segment" "rental_segment",
    "asking_rent" DECIMAL(10,2),
    "sale_price" DECIMAL(12,2),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_photos" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "caption" VARCHAR(200),
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wws_calculations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "created_by_id" UUID,
    "label" VARCHAR(160) NOT NULL,
    "scheme" "wws_scheme" NOT NULL DEFAULT 'WWS',
    "reference_date" DATE NOT NULL,
    "rules_version" VARCHAR(20) NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "total_points" DECIMAL(7,2) NOT NULL,
    "max_rent" DECIMAL(10,2) NOT NULL,
    "segment" "rental_segment" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wws_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tenant_type" "tenant_type" NOT NULL DEFAULT 'PERSON',
    "status" "tenant_status" NOT NULL DEFAULT 'PROSPECT',
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "organization_name" VARCHAR(200),
    "display_name" VARCHAR(200) NOT NULL,
    "email" CITEXT,
    "phone" VARCHAR(30),
    "date_of_birth" DATE,
    "kvk_number" CHAR(8),
    "iban" VARCHAR(34),
    "mailing_address" VARCHAR(300),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "contract_number" VARCHAR(40) NOT NULL,
    "status" "contract_status" NOT NULL DEFAULT 'DRAFT',
    "contract_type" "contract_type" NOT NULL DEFAULT 'INDEFINITE',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "notice_period_months" SMALLINT,
    "base_rent" DECIMAL(10,2) NOT NULL,
    "service_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_day_of_month" SMALLINT NOT NULL DEFAULT 1,
    "indexation_percentage" DECIMAL(5,2),
    "next_indexation_date" DATE,
    "signed_at" TIMESTAMPTZ(3),
    "terminated_at" TIMESTAMPTZ(3),
    "termination_reason" VARCHAR(300),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_tenants" (
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_tenants_pkey" PRIMARY KEY ("contract_id","tenant_id")
);

-- CreateTable
CREATE TABLE "rent_changes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "reason" "rent_change_reason" NOT NULL,
    "effective_date" DATE NOT NULL,
    "previous_rent" DECIMAL(10,2) NOT NULL,
    "new_rent" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2),
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "trade" VARCHAR(100),
    "email" CITEXT,
    "phone" VARCHAR(30),
    "kvk_number" CHAR(8),
    "iban" VARCHAR(34),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "building_id" UUID,
    "unit_id" UUID,
    "reported_by_tenant_id" UUID,
    "contractor_id" UUID,
    "assigned_to_id" UUID,
    "created_by_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "category" "maintenance_category" NOT NULL DEFAULT 'OTHER',
    "priority" "maintenance_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "maintenance_status" NOT NULL DEFAULT 'OPEN',
    "reported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" DATE,
    "completed_at" TIMESTAMPTZ(3),
    "estimated_cost" DECIMAL(12,2),
    "actual_cost" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "category" "document_category" NOT NULL DEFAULT 'OTHER',
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "checksum_sha256" CHAR(64),
    "document_date" DATE,
    "retain_until" DATE,
    "building_id" UUID,
    "unit_id" UUID,
    "tenant_id" UUID,
    "contract_id" UUID,
    "maintenance_request_id" UUID,
    "invoice_id" UUID,
    "expense_id" UUID,
    "wws_calculation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contract_id" UUID,
    "tenant_id" UUID,
    "invoice_number" VARCHAR(40) NOT NULL,
    "kind" "invoice_kind" NOT NULL DEFAULT 'OTHER',
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "description" VARCHAR(300),
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "paid_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "line_type" "invoice_line_type" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tenant_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "received_on" DATE NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" VARCHAR(140),
    "bank_transaction_id" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("payment_id","invoice_id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "building_id" UUID,
    "unit_id" UUID,
    "contractor_id" UUID,
    "maintenance_request_id" UUID,
    "category" "expense_category" NOT NULL DEFAULT 'OTHER',
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "incurred_on" DATE NOT NULL,
    "paid_on" DATE,
    "supplier_reference" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500),
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "actor_id" UUID,
    "actor_label" VARCHAR(120) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "metadata" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_kvk_number_key" ON "companies"("kvk_number");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "user_preferences_active_company_id_idx" ON "user_preferences"("active_company_id");

-- CreateIndex
CREATE INDEX "company_memberships_user_id_idx" ON "company_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_company_id_user_id_key" ON "company_memberships"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "company_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "company_invitations_company_id_idx" ON "company_invitations"("company_id");

-- CreateIndex
CREATE INDEX "company_invitations_email_idx" ON "company_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "buildings_company_id_name_idx" ON "buildings"("company_id", "name");

-- CreateIndex
CREATE INDEX "buildings_company_id_city_idx" ON "buildings"("company_id", "city");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_company_id_id_key" ON "buildings"("company_id", "id");

-- CreateIndex
CREATE INDEX "units_company_id_status_idx" ON "units"("company_id", "status");

-- CreateIndex
CREATE INDEX "units_company_id_city_idx" ON "units"("company_id", "city");

-- CreateIndex
CREATE INDEX "units_building_id_idx" ON "units"("building_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_id_key" ON "units"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_postcode_house_number_house_number_additio_key" ON "units"("company_id", "postcode", "house_number", "house_number_addition");

-- CreateIndex
CREATE UNIQUE INDEX "unit_photos_storage_key_key" ON "unit_photos"("storage_key");

-- CreateIndex
CREATE INDEX "unit_photos_unit_id_position_idx" ON "unit_photos"("unit_id", "position");

-- CreateIndex
CREATE INDEX "wws_calculations_company_id_created_at_idx" ON "wws_calculations"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wws_calculations_unit_id_reference_date_idx" ON "wws_calculations"("unit_id", "reference_date" DESC);

-- CreateIndex
CREATE INDEX "tenants_company_id_status_idx" ON "tenants"("company_id", "status");

-- CreateIndex
CREATE INDEX "tenants_company_id_display_name_idx" ON "tenants"("company_id", "display_name");

-- CreateIndex
CREATE INDEX "tenants_company_id_email_idx" ON "tenants"("company_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_company_id_id_key" ON "tenants"("company_id", "id");

-- CreateIndex
CREATE INDEX "contracts_company_id_status_idx" ON "contracts"("company_id", "status");

-- CreateIndex
CREATE INDEX "contracts_company_id_end_date_idx" ON "contracts"("company_id", "end_date");

-- CreateIndex
CREATE INDEX "contracts_company_id_next_indexation_date_idx" ON "contracts"("company_id", "next_indexation_date");

-- CreateIndex
CREATE INDEX "contracts_unit_id_start_date_idx" ON "contracts"("unit_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_company_id_id_key" ON "contracts"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_company_id_contract_number_key" ON "contracts"("company_id", "contract_number");

-- CreateIndex
CREATE INDEX "contract_tenants_company_id_tenant_id_idx" ON "contract_tenants"("company_id", "tenant_id");

-- CreateIndex
CREATE INDEX "rent_changes_company_id_effective_date_idx" ON "rent_changes"("company_id", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "rent_changes_contract_id_effective_date_key" ON "rent_changes"("contract_id", "effective_date");

-- CreateIndex
CREATE INDEX "contractors_company_id_name_idx" ON "contractors"("company_id", "name");

-- CreateIndex
CREATE INDEX "maintenance_requests_company_id_status_priority_idx" ON "maintenance_requests"("company_id", "status", "priority");

-- CreateIndex
CREATE INDEX "maintenance_requests_unit_id_idx" ON "maintenance_requests"("unit_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_building_id_idx" ON "maintenance_requests"("building_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_contractor_id_idx" ON "maintenance_requests"("contractor_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_assigned_to_id_idx" ON "maintenance_requests"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_company_id_category_idx" ON "documents"("company_id", "category");

-- CreateIndex
CREATE INDEX "documents_company_id_created_at_idx" ON "documents"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "documents_building_id_idx" ON "documents"("building_id");

-- CreateIndex
CREATE INDEX "documents_unit_id_idx" ON "documents"("unit_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_contract_id_idx" ON "documents"("contract_id");

-- CreateIndex
CREATE INDEX "documents_maintenance_request_id_idx" ON "documents"("maintenance_request_id");

-- CreateIndex
CREATE INDEX "documents_invoice_id_idx" ON "documents"("invoice_id");

-- CreateIndex
CREATE INDEX "documents_expense_id_idx" ON "documents"("expense_id");

-- CreateIndex
CREATE INDEX "documents_wws_calculation_id_idx" ON "documents"("wws_calculation_id");

-- CreateIndex
CREATE INDEX "documents_retain_until_idx" ON "documents"("retain_until");

-- CreateIndex
CREATE INDEX "invoices_company_id_status_due_date_idx" ON "invoices"("company_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_contract_id_period_start_idx" ON "invoices"("contract_id", "period_start");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_position_key" ON "invoice_lines"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "payments_company_id_received_on_idx" ON "payments"("company_id", "received_on" DESC);

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_company_id_bank_transaction_id_key" ON "payments"("company_id", "bank_transaction_id");

-- CreateIndex
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "expenses_company_id_incurred_on_idx" ON "expenses"("company_id", "incurred_on" DESC);

-- CreateIndex
CREATE INDEX "expenses_company_id_category_idx" ON "expenses"("company_id", "category");

-- CreateIndex
CREATE INDEX "expenses_building_id_idx" ON "expenses"("building_id");

-- CreateIndex
CREATE INDEX "expenses_unit_id_idx" ON "expenses"("unit_id");

-- CreateIndex
CREATE INDEX "expenses_maintenance_request_id_idx" ON "expenses"("maintenance_request_id");

-- CreateIndex
CREATE INDEX "expenses_contractor_id_idx" ON "expenses"("contractor_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_active_company_id_fkey" FOREIGN KEY ("active_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_building_id_fkey" FOREIGN KEY ("company_id", "building_id") REFERENCES "buildings"("company_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_photos" ADD CONSTRAINT "unit_photos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wws_calculations" ADD CONSTRAINT "wws_calculations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wws_calculations" ADD CONSTRAINT "wws_calculations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wws_calculations" ADD CONSTRAINT "wws_calculations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_unit_id_fkey" FOREIGN KEY ("company_id", "unit_id") REFERENCES "units"("company_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_tenants" ADD CONSTRAINT "contract_tenants_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "contracts"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_tenants" ADD CONSTRAINT "contract_tenants_company_id_tenant_id_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "tenants"("company_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_changes" ADD CONSTRAINT "rent_changes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_changes" ADD CONSTRAINT "rent_changes_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "contracts"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reported_by_tenant_id_fkey" FOREIGN KEY ("reported_by_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_maintenance_request_id_fkey" FOREIGN KEY ("maintenance_request_id") REFERENCES "maintenance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_wws_calculation_id_fkey" FOREIGN KEY ("wws_calculation_id") REFERENCES "wws_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_maintenance_request_id_fkey" FOREIGN KEY ("maintenance_request_id") REFERENCES "maintenance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- Aanvullende constraints
-- Prisma kan CHECK-, EXCLUDE- en partiële constraints niet in schema.prisma uitdrukken;
-- ze staan daarom hier.
-- =====================================================================

-- ---------- Bedrijven en gebruikers ----------
ALTER TABLE "companies"
  ADD CONSTRAINT "companies_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "companies_kvk_format" CHECK ("kvk_number" ~ '^[0-9]{8}$'),
  ADD CONSTRAINT "companies_iban_format" CHECK ("iban" ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9 ]{11,40}$'),
  ADD CONSTRAINT "companies_country_format" CHECK ("country" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "companies_rent_indexation_range" CHECK ("default_rent_indexation" BETWEEN 0 AND 25),
  ADD CONSTRAINT "companies_payment_term_range" CHECK ("default_payment_term_days" BETWEEN 0 AND 90),
  ADD CONSTRAINT "companies_next_invoice_number_positive" CHECK ("next_invoice_number" >= 1);

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format" CHECK ("username" ~ '^[A-Za-z0-9_.-]{3,40}$'),
  ADD CONSTRAINT "users_email_format" CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD CONSTRAINT "users_session_version_positive" CHECK ("session_version" >= 1);

ALTER TABLE "user_preferences"
  ADD CONSTRAINT "user_preferences_contract_reminder_range" CHECK ("contract_reminder_days" BETWEEN 7 AND 365),
  ADD CONSTRAINT "user_preferences_payment_reminder_range" CHECK ("payment_reminder_days" BETWEEN 1 AND 30),
  ADD CONSTRAINT "user_preferences_landing_page_valid" CHECK ("landing_page" IN ('dashboard', 'properties', 'tenants', 'contracts', 'maintenance', 'finance'));

ALTER TABLE "company_invitations"
  ADD CONSTRAINT "company_invitations_expiry_after_creation" CHECK ("expires_at" > "created_at");

-- Maximaal één openstaande uitnodiging per e-mailadres per bedrijf.
CREATE UNIQUE INDEX "company_invitations_open_unique" ON "company_invitations" ("company_id", "email") WHERE "accepted_at" IS NULL;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expiry_after_creation" CHECK ("expires_at" > "created_at");

-- ---------- Vastgoed ----------
ALTER TABLE "buildings"
  ADD CONSTRAINT "buildings_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "buildings_year_built_range" CHECK ("year_built" BETWEEN 1000 AND 2100),
  ADD CONSTRAINT "buildings_country_format" CHECK ("country" ~ '^[A-Z]{2}$');

ALTER TABLE "units"
  ADD CONSTRAINT "units_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "units_house_number_positive" CHECK ("house_number" > 0),
  ADD CONSTRAINT "units_living_area_positive" CHECK ("living_area" > 0),
  ADD CONSTRAINT "units_rooms_non_negative" CHECK ("rooms" >= 0),
  ADD CONSTRAINT "units_bedrooms_within_rooms" CHECK ("bedrooms" >= 0 AND ("rooms" IS NULL OR "bedrooms" <= "rooms")),
  ADD CONSTRAINT "units_year_built_range" CHECK ("year_built" BETWEEN 1000 AND 2100),
  ADD CONSTRAINT "units_amounts_non_negative" CHECK (
    coalesce("woz_value", 0) >= 0 AND coalesce("wws_points", 0) >= 0 AND coalesce("max_rent", 0) >= 0
    AND coalesce("asking_rent", 0) >= 0 AND coalesce("sale_price", 0) >= 0
  );

ALTER TABLE "unit_photos"
  ADD CONSTRAINT "unit_photos_position_non_negative" CHECK ("position" >= 0);

ALTER TABLE "wws_calculations"
  ADD CONSTRAINT "wws_calculations_points_non_negative" CHECK ("total_points" >= 0),
  ADD CONSTRAINT "wws_calculations_max_rent_non_negative" CHECK ("max_rent" >= 0),
  ADD CONSTRAINT "wws_calculations_input_is_object" CHECK (jsonb_typeof("input") = 'object'),
  ADD CONSTRAINT "wws_calculations_result_is_object" CHECK (jsonb_typeof("result") = 'object');

-- ---------- Huurders en contracten ----------
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_display_name_not_blank" CHECK (btrim("display_name") <> ''),
  ADD CONSTRAINT "tenants_organization_has_name" CHECK ("tenant_type" <> 'ORGANIZATION' OR "organization_name" IS NOT NULL),
  ADD CONSTRAINT "tenants_kvk_format" CHECK ("kvk_number" ~ '^[0-9]{8}$');

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_end_after_start" CHECK ("end_date" IS NULL OR "end_date" > "start_date"),
  ADD CONSTRAINT "contracts_fixed_term_has_end" CHECK ("contract_type" <> 'FIXED_TERM' OR "end_date" IS NOT NULL),
  ADD CONSTRAINT "contracts_amounts_non_negative" CHECK ("base_rent" >= 0 AND "service_charges" >= 0 AND "deposit_amount" >= 0),
  ADD CONSTRAINT "contracts_payment_day_range" CHECK ("payment_day_of_month" BETWEEN 1 AND 28),
  ADD CONSTRAINT "contracts_indexation_range" CHECK ("indexation_percentage" BETWEEN 0 AND 25),
  ADD CONSTRAINT "contracts_notice_period_range" CHECK ("notice_period_months" BETWEEN 0 AND 24),
  ADD CONSTRAINT "contracts_terminated_has_date" CHECK ("status" <> 'TERMINATED' OR "terminated_at" IS NOT NULL);

-- Een woning kan nooit twee overlappende actieve contracten hebben.
-- daterange(start, NULL) is naar boven onbegrensd: onbepaalde tijd overlapt met alles daarna.
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_no_overlapping_active" EXCLUDE USING gist (
    "unit_id" WITH =,
    daterange("start_date", "end_date", '[)') WITH &&
  ) WHERE ("status" = 'ACTIVE');

-- Maximaal één hoofdhuurder per contract.
CREATE UNIQUE INDEX "contract_tenants_one_primary" ON "contract_tenants" ("contract_id") WHERE "is_primary";

ALTER TABLE "rent_changes"
  ADD CONSTRAINT "rent_changes_amounts_non_negative" CHECK ("previous_rent" >= 0 AND "new_rent" >= 0),
  ADD CONSTRAINT "rent_changes_percentage_range" CHECK ("percentage" BETWEEN -100 AND 100);

-- ---------- Onderhoud ----------
ALTER TABLE "contractors"
  ADD CONSTRAINT "contractors_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "contractors_kvk_format" CHECK ("kvk_number" ~ '^[0-9]{8}$');

ALTER TABLE "maintenance_requests"
  ADD CONSTRAINT "maintenance_requests_has_location" CHECK ("building_id" IS NOT NULL OR "unit_id" IS NOT NULL),
  ADD CONSTRAINT "maintenance_requests_costs_non_negative" CHECK (coalesce("estimated_cost", 0) >= 0 AND coalesce("actual_cost", 0) >= 0),
  ADD CONSTRAINT "maintenance_requests_completed_has_date" CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);

-- ---------- Documenten ----------
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_size_non_negative" CHECK ("size_bytes" >= 0),
  ADD CONSTRAINT "documents_checksum_format" CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$');

-- ---------- Financiën ----------
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_due_after_issue" CHECK ("due_date" >= "issue_date"),
  ADD CONSTRAINT "invoices_period_order" CHECK ("period_end" IS NULL OR ("period_start" IS NOT NULL AND "period_end" >= "period_start")),
  ADD CONSTRAINT "invoices_total_consistent" CHECK ("total" = "subtotal" + "vat_amount"),
  ADD CONSTRAINT "invoices_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "invoices_rent_has_period" CHECK ("kind" <> 'RENT' OR ("contract_id" IS NOT NULL AND "period_start" IS NOT NULL)),
  ADD CONSTRAINT "invoices_paid_has_date" CHECK ("status" <> 'PAID' OR "paid_at" IS NOT NULL),
  ADD CONSTRAINT "invoices_cancelled_has_date" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL);

-- Dezelfde huurperiode van een contract wordt nooit twee keer gefactureerd (geannuleerde facturen tellen niet mee).
CREATE UNIQUE INDEX "invoices_one_rent_per_period" ON "invoices" ("contract_id", "period_start") WHERE "kind" = 'RENT' AND "status" <> 'CANCELLED';

-- Openstaande posten snel vinden (dashboard, achterstanden).
CREATE INDEX "invoices_outstanding_due" ON "invoices" ("company_id", "due_date") WHERE "status" IN ('OPEN', 'PARTIALLY_PAID');

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_position_non_negative" CHECK ("position" >= 0),
  ADD CONSTRAINT "invoice_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "invoice_lines_vat_rate_range" CHECK ("vat_rate" BETWEEN 0 AND 100),
  ADD CONSTRAINT "invoice_lines_amount_consistent" CHECK ("amount" = round("quantity" * "unit_price", 2));

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amounts_non_negative" CHECK ("amount" >= 0 AND "vat_amount" >= 0),
  ADD CONSTRAINT "expenses_paid_after_incurred" CHECK ("paid_on" IS NULL OR "paid_on" >= "incurred_on");
