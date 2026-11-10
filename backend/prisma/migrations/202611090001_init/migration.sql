CREATE TABLE "Config" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL);
CREATE TABLE "Content" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "title" TEXT NOT NULL, "type" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '', "coverUrl" TEXT, "fileUrl" TEXT, "hlsUrl" TEXT, "pdfUrl" TEXT,
 "imagesJson" JSONB, "sortOrder" INTEGER NOT NULL DEFAULT 0, "parentId" INTEGER,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Content_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Content_parentId_sortOrder_idx" ON "Content"("parentId", "sortOrder");
CREATE TABLE "AccessLog" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "ip" TEXT NOT NULL, "userAgent" TEXT, "contentId" INTEGER, "action" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");
