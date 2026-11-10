ALTER TABLE "Content" ADD COLUMN "scene" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Content" ADD COLUMN "topics" JSONB;
CREATE INDEX "Content_scene_sortOrder_idx" ON "Content"("scene", "sortOrder");
