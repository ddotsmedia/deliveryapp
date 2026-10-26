CREATE TYPE "public"."order_status" AS ENUM('PLACED', 'PAYMENT_AUTHORIZED', 'MERCHANT_PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'REJECTED', 'CANCELLED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('PENDING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('ONLINE', 'OFFLINE', 'BUSY');--> statement-breakpoint
CREATE TYPE "public"."account_owner" AS ENUM('PLATFORM', 'MERCHANT', 'COURIER');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('REVENUE', 'LIABILITY', 'ASSET', 'EQUITY');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('PENDING', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."courier_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'REGISTER', 'VERIFY');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'MERCHANT_OWNER', 'MERCHANT_STAFF', 'COURIER', 'DISPATCHER', 'SUPPORT', 'FINANCE', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('BICYCLE', 'MOTORBIKE', 'CAR', 'WALK');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('ORDER', 'PAYMENT', 'DELIVERY', 'ACCOUNT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" varchar(60),
	"address_line1" varchar(200) NOT NULL,
	"apartment" varchar(60),
	"location" geometry(Point,4326) NOT NULL,
	"instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"is_closed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"address_line1" varchar(200) NOT NULL,
	"address_line2" varchar(200),
	"location" geometry(Point,4326) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"menu_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"base_price_fils" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"allergens" text[] DEFAULT '{}' NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_multi_select" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"price_adjustment_fils" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"cuisine_types" text[] DEFAULT '{}' NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"commission_rate" numeric(5, 4) DEFAULT '0.2000' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"city" varchar(60) NOT NULL,
	"boundary" geometry(Polygon,4326) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(40),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'PLACED' NOT NULL,
	"special_instructions" text,
	"idempotency_key" varchar(128) NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(30) DEFAULT 'mock' NOT NULL,
	"provider_intent_id" varchar(100),
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"amount_fils" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payment_intents_provider_intent_id_unique" UNIQUE("provider_intent_id"),
	CONSTRAINT "payment_intents_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cart_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"subtotal_fils" integer NOT NULL,
	"delivery_fee_fils" integer NOT NULL,
	"service_fee_fils" integer NOT NULL,
	"vat_fils" integer NOT NULL,
	"tip_fils" integer DEFAULT 0 NOT NULL,
	"total_fils" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"amount_fils" integer NOT NULL,
	"reason_code" varchar(40) NOT NULL,
	"reason_notes" text,
	"provider_refund_id" varchar(100),
	"status" "refund_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "assignments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "assignments_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
CREATE TABLE "courier_shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"courier_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'OFFLINE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"status" "offer_status" DEFAULT 'PENDING' NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proof_of_delivery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assignment_id" uuid NOT NULL,
	"photo_url" text NOT NULL,
	"signature_url" text,
	"delivered_at" timestamp with time zone NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_of_delivery_assignment_id_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "courier_payouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"courier_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount_fils" integer NOT NULL,
	"status" "settlement_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "account_type" NOT NULL,
	"owner_type" "account_owner" NOT NULL,
	"owner_id" uuid,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"reference_type" varchar(40) NOT NULL,
	"reference_id" uuid NOT NULL,
	"debit_fils" integer DEFAULT 0 NOT NULL,
	"credit_fils" integer DEFAULT 0 NOT NULL,
	"description" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_non_negative" CHECK ("ledger_entries"."debit_fils" >= 0 AND "ledger_entries"."credit_fils" >= 0),
	CONSTRAINT "ledger_one_side" CHECK (NOT ("ledger_entries"."debit_fils" > 0 AND "ledger_entries"."credit_fils" > 0))
);
--> statement-breakpoint
CREATE TABLE "merchant_settlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_fils" integer NOT NULL,
	"commission_fils" integer NOT NULL,
	"net_fils" integer NOT NULL,
	"status" "settlement_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"status" "courier_status" DEFAULT 'PENDING' NOT NULL,
	"emirates_id_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courier_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name_first" varchar(100) NOT NULL,
	"name_last" varchar(100),
	"preferred_language" "language" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"trade_license_number" varchar(60),
	"vat_trn" varchar(30),
	"status" "org_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_organizations_trade_license_number_unique" UNIQUE("trade_license_number")
);
--> statement-breakpoint
CREATE TABLE "merchant_staff" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_staff_user_org" UNIQUE("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(128) NOT NULL,
	"device_fingerprint" varchar(128),
	"ip_address" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(254),
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(40),
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(60) NOT NULL,
	"resource_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"reporter_id" uuid NOT NULL,
	"category" "ticket_category" NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"event_id" varchar(128) PRIMARY KEY NOT NULL,
	"provider" varchar(30) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"template" varchar(60) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_schedules" ADD CONSTRAINT "branch_schedules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_org_id_merchant_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."merchant_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_customer_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."customer_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_courier_id_courier_profiles_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_offer_id_dispatch_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."dispatch_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shifts" ADD CONSTRAINT "courier_shifts_courier_id_courier_profiles_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shifts" ADD CONSTRAINT "courier_shifts_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_courier_id_courier_profiles_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_payouts" ADD CONSTRAINT "courier_payouts_courier_id_courier_profiles_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_org_id_merchant_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."merchant_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD CONSTRAINT "courier_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_org_id_merchant_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."merchant_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_zone_idx" ON "branches" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_zone_idx" ON "orders" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "shifts_zone_status_idx" ON "courier_shifts" USING btree ("zone_id","status");--> statement-breakpoint
CREATE INDEX "offers_order_idx" ON "dispatch_offers" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "offers_status_expiry_idx" ON "dispatch_offers" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "ledger_ref_idx" ON "ledger_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");