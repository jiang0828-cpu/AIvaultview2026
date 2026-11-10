CREATE TABLE "LiteraryWriter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LiteraryWriter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Content" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LiteraryWriter_projectId_idx" ON "LiteraryWriter"("projectId");
