ALTER TABLE "DialogueScenario" ADD COLUMN "startStageId" TEXT;

CREATE TABLE "DialogueStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "openingLineEn" TEXT NOT NULL,
    "openingLineZh" TEXT,
    "objective" TEXT NOT NULL,
    "slotsJson" TEXT NOT NULL DEFAULT '[]',
    "completionJson" TEXT NOT NULL DEFAULT '{}',
    "assessmentJson" TEXT NOT NULL DEFAULT '{}',
    "hintsJson" TEXT NOT NULL DEFAULT '{}',
    "outcomesJson" TEXT NOT NULL DEFAULT '[]',
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DialogueStage_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DialogueScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DialogueTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "fromStageId" TEXT NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "conditionJson" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "toStageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DialogueTransition_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DialogueScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueTransition_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "DialogueStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueTransition_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "DialogueStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "DialogueSession" ADD COLUMN "currentStageId" TEXT;
ALTER TABLE "DialogueSession" ADD COLUMN "stageStateJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "DialogueAttempt" ADD COLUMN "stageId" TEXT;
ALTER TABLE "DialogueAttempt" ADD COLUMN "stageStateJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "DialogueProfileEvent" ADD COLUMN "stageId" TEXT;

CREATE INDEX "DialogueStage_scenarioId_idx" ON "DialogueStage"("scenarioId");
CREATE INDEX "DialogueStage_scenarioId_order_idx" ON "DialogueStage"("scenarioId", "order");
CREATE INDEX "DialogueTransition_scenarioId_idx" ON "DialogueTransition"("scenarioId");
CREATE INDEX "DialogueTransition_fromStageId_idx" ON "DialogueTransition"("fromStageId");
CREATE INDEX "DialogueTransition_fromStageId_outcomeKey_idx" ON "DialogueTransition"("fromStageId", "outcomeKey");
CREATE INDEX "DialogueTransition_toStageId_idx" ON "DialogueTransition"("toStageId");
CREATE INDEX "DialogueSession_currentStageId_idx" ON "DialogueSession"("currentStageId");
CREATE INDEX "DialogueAttempt_stageId_idx" ON "DialogueAttempt"("stageId");
CREATE INDEX "DialogueProfileEvent_stageId_idx" ON "DialogueProfileEvent"("stageId");
