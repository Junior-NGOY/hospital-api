-- P0.3: attach existing patients (and users without a hospital) to the first Hospital.
-- If no hospital exists, this is a no-op and hospitalId stays nullable.

UPDATE "patients"
SET "hospitalId" = (SELECT id FROM "hospitals" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "hospitalId" IS NULL
  AND EXISTS (SELECT 1 FROM "hospitals");

UPDATE "users"
SET "hospitalId" = (SELECT id FROM "hospitals" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "hospitalId" IS NULL
  AND EXISTS (SELECT 1 FROM "hospitals");
