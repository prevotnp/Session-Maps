CREATE TABLE "drone_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_path" text NOT NULL,
	"captured_at" timestamp NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"is_public" boolean DEFAULT false,
	"password" text,
	"ne_lat" numeric NOT NULL,
	"ne_lng" numeric NOT NULL,
	"sw_lat" numeric NOT NULL,
	"sw_lng" numeric NOT NULL,
	"size_in_mb" integer NOT NULL,
	"is_active" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"latitude" numeric(10, 6) NOT NULL,
	"longitude" numeric(10, 6) NOT NULL,
	"elevation" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "map_drawings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"coordinates" text NOT NULL,
	"properties" text,
	"measurement_value" numeric,
	"measurement_unit" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offline_map_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"ne_lat" numeric NOT NULL,
	"ne_lng" numeric NOT NULL,
	"sw_lat" numeric NOT NULL,
	"sw_lng" numeric NOT NULL,
	"includes_drone_data" boolean DEFAULT true,
	"size_in_mb" integer NOT NULL,
	"downloaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"is_admin" boolean DEFAULT false,
	"is_subscribed" boolean DEFAULT false,
	"subscription_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waypoint_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"waypoint_id" integer NOT NULL,
	"shared_with_user_id" integer NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"shared_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "waypoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"latitude" numeric(10, 6) NOT NULL,
	"longitude" numeric(10, 6) NOT NULL,
	"elevation" numeric(10, 2),
	"is_shared" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "drone_images" ADD CONSTRAINT "drone_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_drawings" ADD CONSTRAINT "map_drawings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_map_areas" ADD CONSTRAINT "offline_map_areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waypoint_shares" ADD CONSTRAINT "waypoint_shares_waypoint_id_waypoints_id_fk" FOREIGN KEY ("waypoint_id") REFERENCES "public"."waypoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waypoint_shares" ADD CONSTRAINT "waypoint_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waypoints" ADD CONSTRAINT "waypoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;