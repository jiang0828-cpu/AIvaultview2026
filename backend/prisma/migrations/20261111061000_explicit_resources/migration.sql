ALTER TABLE "Content" ADD COLUMN "assetsJson" JSONB;
UPDATE "Content" SET "assetsJson" = '["/media/projects/mrna/research-data.json"]'
WHERE "isProject" = true AND
  ("title" LIKE '%mRNA%' OR EXISTS (SELECT 1 FROM "Content" AS child
    WHERE child."parentId" = "Content"."id" AND instr(child."description", '<!-- mrna-v2-owned -->') > 0));
