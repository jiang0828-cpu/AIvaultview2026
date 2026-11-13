-- CreateTable
CREATE TABLE "ResearchStudy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "researchObject" TEXT NOT NULL DEFAULT '',
    "goal" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchStudy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studyId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "inputMaterials" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "report" TEXT NOT NULL DEFAULT '',
    "sources" JSONB NOT NULL,
    "conclusions" JSONB NOT NULL,
    "limitations" TEXT NOT NULL DEFAULT '',
    "openQuestions" TEXT NOT NULL DEFAULT '',
    "asOf" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchTask_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTaskVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchTaskVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ResearchTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchSynthesis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "executiveSummary" TEXT NOT NULL DEFAULT '',
    "marketOpportunity" TEXT NOT NULL DEFAULT '',
    "targetUsers" TEXT NOT NULL DEFAULT '',
    "feasibility" TEXT NOT NULL DEFAULT '',
    "competition" TEXT NOT NULL DEFAULT '',
    "risks" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "openQuestions" JSONB NOT NULL,
    "sourceTaskIds" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchSynthesis_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ResearchStudy_projectId_updatedAt_idx" ON "ResearchStudy"("projectId", "updatedAt");
CREATE UNIQUE INDEX "ResearchTask_studyId_kind_key" ON "ResearchTask"("studyId", "kind");
CREATE INDEX "ResearchTask_studyId_status_idx" ON "ResearchTask"("studyId", "status");
CREATE UNIQUE INDEX "ResearchTaskVersion_taskId_version_key" ON "ResearchTaskVersion"("taskId", "version");
CREATE UNIQUE INDEX "ResearchSynthesis_studyId_key" ON "ResearchSynthesis"("studyId");
ALTER TABLE "ProjectAccess" ADD COLUMN "canEditResearch" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "ResearchSynthesisVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "synthesisId" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchSynthesisVersion_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "ResearchSynthesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ResearchSynthesisVersion_synthesisId_createdAt_idx" ON "ResearchSynthesisVersion"("synthesisId", "createdAt");
