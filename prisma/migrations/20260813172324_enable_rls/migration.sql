-- Row Level Security: deny-all by default.
--
-- Prisma connects as the table owner and is unaffected by these policies, so
-- the application keeps working exactly as before. What changes is everything
-- else: Supabase hands out an `anon` key to make Auth work, and that key can
-- reach PostgREST. Without RLS enabled, that key could read `orders` — every
-- customer's name, phone, email and address — straight over HTTP.
--
-- Enabling RLS with no policies attached is the strictest possible state: no
-- row is visible to `anon` or `authenticated` for any operation. Policies get
-- added later only if some table genuinely needs to be reachable that way.
-- Authorisation for the app itself stays where it already is — `requireAdmin()`
-- in the route handlers, checked against AppUser.role.

ALTER TABLE "public"."app_users"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."products"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_variants"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."banners"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_items"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log"          ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even with RLS on, do not leave table-level grants lying
-- around for the roles PostgREST authenticates as.
REVOKE ALL ON ALL TABLES    IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;
