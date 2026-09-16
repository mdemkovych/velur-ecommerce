-- A banner is three photographs, and there is no other kind.
--
-- `layout` (SINGLE / SPLIT_2 / COLLAGE_3) decided how many photographs a banner
-- held and how the hero cut its frame into cells. It asked a manager a question
-- whose answer changed the shape of every cell at every width at once, so
-- "one photo on the full width" meant a wide landscape on a desktop and a
-- portrait crop of the same file on a phone. Dropped on the owner's decision
-- (2026-08-19); `bannerSchema` now requires exactly three.
--
-- Rows that carried one or two photographs keep them. Nothing here can invent
-- the missing ones, so they are left short on purpose and the admin list marks
-- them — a banner silently rendering an empty third column is the failure this
-- avoids.
ALTER TABLE "banners" DROP COLUMN "layout";

DROP TYPE "BannerLayout";
