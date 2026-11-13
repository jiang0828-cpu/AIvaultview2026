CREATE TABLE "TripPlan" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "projectId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "transport" TEXT NOT NULL DEFAULT '',
  "companions" TEXT NOT NULL DEFAULT '',
  "budget" INTEGER,
  "actualSpent" INTEGER,
  "itinerary" JSONB NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TripPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TripPlan_userId_projectId_startDate_idx" ON "TripPlan"("userId", "projectId", "startDate");
