-- Progress for a sync that spans several invocations.
--
-- A full refresh of the branch directory is around 180 MB over roughly a
-- hundred paged requests, and Nova Poshta offers no "what changed since". That
-- does not reliably fit in one serverless function, so the run carries its own
-- position and resumes where it stopped.
--
-- Both nullable, and null is the resting state: no run is under way. The
-- existing `syncedAt` and `rowCount` keep describing the last *completed* run,
-- which is what `isDirectoryReady` reads — a half-finished refresh must never
-- be able to make the directory look empty.
ALTER TABLE "public"."np_sync"
    ADD COLUMN "runStartedAt" TIMESTAMP(3),
    ADD COLUMN "nextPage"     INTEGER;
