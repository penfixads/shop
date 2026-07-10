-- ============================================================
-- PENFIX SHOP — Schema additions
-- Runs in the SAME Supabase project as penfixads-OS (shared auth.users
-- and shared categories/subcategories catalog), but adds narrow public
-- read access for anonymous shop browsing.
-- Run this in the Supabase SQL Editor (staging, then prod once shop
-- deploys there).
-- ============================================================

-- Anonymous visitors need to browse the catalog before registering/logging
-- in (per the confirmed flow: browse + price freely, only gate at
-- purchase). categories/subcategories are currently locked to
-- `authenticated` only (see penfixads-OS/supabase/schema.sql), so add a
-- second, narrower policy alongside the existing one — SELECT-only,
-- active rows only, no write access. This does NOT touch the existing
-- `auth_users_categories`/`auth_users_subcategories` policies used by the
-- internal JO system.
create policy "public_read_active_categories" on categories
  for select using (is_active = true);

create policy "public_read_active_subcategories" on subcategories
  for select using (active = true);
