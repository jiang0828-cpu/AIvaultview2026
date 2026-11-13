ALTER TABLE "Content" ADD COLUMN "isProject" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Content" SET "isProject" = true WHERE "type" = 'folder' AND
  ("title" LIKE '项目%' OR ("title" = '爱的城堡' AND "scene" = 'life') OR
   ("scene" = 'system' AND instr("description", '<!-- WORLD_PROJECT -->') > 0));
CREATE TABLE "User" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'visitor',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE TABLE "ProjectAccess" (
  "userId" INTEGER NOT NULL,
  "projectId" INTEGER NOT NULL,
  PRIMARY KEY ("userId", "projectId"),
  CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");
ALTER TABLE "AccessLog" ADD COLUMN "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
