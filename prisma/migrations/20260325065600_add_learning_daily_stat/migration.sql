-- CreateTable
CREATE TABLE "LearningDailyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "dateKey" TEXT NOT NULL,
    "studySeconds" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" INTEGER NOT NULL DEFAULT 0,
    "dictationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "LearningDailyStat_userId_idx" ON "LearningDailyStat"("userId");

-- CreateIndex
CREATE INDEX "LearningDailyStat_dateKey_idx" ON "LearningDailyStat"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "LearningDailyStat_userId_dateKey_key" ON "LearningDailyStat"("userId", "dateKey");
