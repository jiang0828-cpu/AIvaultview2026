CREATE TABLE "PrecisionBriefRun" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "projectId" INTEGER NOT NULL, "runKey" TEXT NOT NULL, "issueDate" TEXT NOT NULL,
 "windowStart" DATETIME NOT NULL, "windowEnd" DATETIME NOT NULL,
 "firstIssue" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL DEFAULT 'queued',
 "summary" TEXT NOT NULL DEFAULT '', "publishedAt" DATETIME, "errorMessage" TEXT NOT NULL DEFAULT '',
 "isCurrent" BOOLEAN NOT NULL DEFAULT false, "validation" JSONB NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PrecisionBriefRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrecisionBriefRun_projectId_runKey_key" ON "PrecisionBriefRun"("projectId", "runKey");
CREATE UNIQUE INDEX "PrecisionBriefRun_one_current_project" ON "PrecisionBriefRun"("projectId") WHERE "isCurrent" = true;
CREATE INDEX "PrecisionBriefRun_projectId_createdAt_idx" ON "PrecisionBriefRun"("projectId", "createdAt");
CREATE INDEX "PrecisionBriefRun_projectId_isCurrent_idx" ON "PrecisionBriefRun"("projectId", "isCurrent");
CREATE TABLE "PrecisionBriefTask" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "runId" INTEGER NOT NULL, "kind" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'queued', "rawReport" TEXT NOT NULL DEFAULT '', "coverage" TEXT NOT NULL DEFAULT '',
 "startedAt" DATETIME, "completedAt" DATETIME, "errorMessage" TEXT NOT NULL DEFAULT '',
 CONSTRAINT "PrecisionBriefTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrecisionBriefRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrecisionBriefTask_runId_kind_key" ON "PrecisionBriefTask"("runId", "kind");
CREATE TABLE "PrecisionBriefItem" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "runId" INTEGER NOT NULL, "section" TEXT NOT NULL,
 "title" TEXT NOT NULL, "message" TEXT NOT NULL, "attention" TEXT NOT NULL, "commentary" TEXT NOT NULL,
 "severity" TEXT NOT NULL DEFAULT 'normal', "sourceIds" JSONB NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "PrecisionBriefItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrecisionBriefRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PrecisionBriefItem_runId_section_sortOrder_idx" ON "PrecisionBriefItem"("runId", "section", "sortOrder");
CREATE TABLE "PrecisionBriefSource" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "runId" INTEGER NOT NULL, "key" TEXT NOT NULL,
 "title" TEXT NOT NULL, "publisher" TEXT NOT NULL, "publishedAt" TEXT NOT NULL, "accessedAt" DATETIME NOT NULL,
 "url" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "verified" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "PrecisionBriefSource_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrecisionBriefRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrecisionBriefSource_runId_key_key" ON "PrecisionBriefSource"("runId", "key");
