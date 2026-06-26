PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Rebuild DialogueSession so scenarioId can be nullable for free conversations.
CREATE TABLE "new_DialogueSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'scenario',
    "scenarioId" TEXT,
    "userId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "completedNodeCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DialogueSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DialogueScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueSession_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "DialogueNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_DialogueSession" (
    "id",
    "mode",
    "scenarioId",
    "userId",
    "currentNodeId",
    "status",
    "metadataJson",
    "totalScore",
    "completedNodeCount",
    "lastActivityAt",
    "completedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'scenario',
    "scenarioId",
    "userId",
    "currentNodeId",
    "status",
    '{}',
    "totalScore",
    "completedNodeCount",
    "lastActivityAt",
    "completedAt",
    "createdAt",
    "updatedAt"
FROM "DialogueSession";

DROP TABLE "DialogueSession";
ALTER TABLE "new_DialogueSession" RENAME TO "DialogueSession";

CREATE INDEX "DialogueSession_scenarioId_idx" ON "DialogueSession"("scenarioId");
CREATE INDEX "DialogueSession_mode_idx" ON "DialogueSession"("mode");
CREATE INDEX "DialogueSession_userId_idx" ON "DialogueSession"("userId");
CREATE INDEX "DialogueSession_status_idx" ON "DialogueSession"("status");
CREATE INDEX "DialogueSession_lastActivityAt_idx" ON "DialogueSession"("lastActivityAt");

-- Rebuild DialogueAttempt so scenarioId can be nullable and each row can also serve as a ConversationTurn.
CREATE TABLE "new_DialogueAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "nodeId" TEXT,
    "userId" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'text',
    "turnStatus" TEXT NOT NULL DEFAULT 'completed',
    "turnIndex" INTEGER NOT NULL DEFAULT 0,
    "transcriptSource" TEXT NOT NULL DEFAULT 'text_input',
    "userText" TEXT NOT NULL DEFAULT '',
    "transcriptText" TEXT,
    "transcriptJson" TEXT NOT NULL DEFAULT '{}',
    "aiReplyJson" TEXT NOT NULL DEFAULT '{}',
    "assessmentJson" TEXT,
    "profileEventsJson" TEXT NOT NULL DEFAULT '[]',
    "errorJson" TEXT,
    "routerIntent" TEXT NOT NULL DEFAULT 'scene_answer',
    "routerJson" TEXT NOT NULL DEFAULT '{}',
    "evaluatorJson" TEXT,
    "coachJson" TEXT,
    "roleReplyEn" TEXT,
    "coachReplyZh" TEXT,
    "betterAnswerEn" TEXT,
    "passed" BOOLEAN,
    "score" INTEGER,
    "nextAction" TEXT NOT NULL DEFAULT 'stay',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DialogueAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DialogueSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueAttempt_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "DialogueNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DialogueAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_DialogueAttempt" (
    "id",
    "sessionId",
    "scenarioId",
    "nodeId",
    "userId",
    "inputMode",
    "turnStatus",
    "turnIndex",
    "transcriptSource",
    "userText",
    "transcriptText",
    "transcriptJson",
    "aiReplyJson",
    "assessmentJson",
    "profileEventsJson",
    "errorJson",
    "routerIntent",
    "routerJson",
    "evaluatorJson",
    "coachJson",
    "roleReplyEn",
    "coachReplyZh",
    "betterAnswerEn",
    "passed",
    "score",
    "nextAction",
    "createdAt"
)
SELECT
    "id",
    "sessionId",
    "scenarioId",
    "nodeId",
    "userId",
    "inputMode",
    'completed',
    ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", "id") - 1,
    CASE WHEN "inputMode" = 'audio' THEN 'file_transcription' ELSE 'text_input' END,
    "userText",
    "transcriptText",
    '{}',
    '{}',
    "evaluatorJson",
    '[]',
    NULL,
    "routerIntent",
    "routerJson",
    "evaluatorJson",
    "coachJson",
    "roleReplyEn",
    "coachReplyZh",
    "betterAnswerEn",
    "passed",
    "score",
    "nextAction",
    "createdAt"
FROM "DialogueAttempt";

DROP TABLE "DialogueAttempt";
ALTER TABLE "new_DialogueAttempt" RENAME TO "DialogueAttempt";

CREATE INDEX "DialogueAttempt_sessionId_idx" ON "DialogueAttempt"("sessionId");
CREATE INDEX "DialogueAttempt_sessionId_turnIndex_idx" ON "DialogueAttempt"("sessionId", "turnIndex");
CREATE INDEX "DialogueAttempt_scenarioId_idx" ON "DialogueAttempt"("scenarioId");
CREATE INDEX "DialogueAttempt_nodeId_idx" ON "DialogueAttempt"("nodeId");
CREATE INDEX "DialogueAttempt_userId_idx" ON "DialogueAttempt"("userId");
CREATE INDEX "DialogueAttempt_createdAt_idx" ON "DialogueAttempt"("createdAt");

CREATE TABLE "DialogueProfileEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "scenarioId" TEXT,
    "nodeId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "evidence" TEXT NOT NULL DEFAULT '',
    "suggestion" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DialogueProfileEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueProfileEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DialogueSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueProfileEvent_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "DialogueAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DialogueProfileEvent_userId_idx" ON "DialogueProfileEvent"("userId");
CREATE INDEX "DialogueProfileEvent_sessionId_idx" ON "DialogueProfileEvent"("sessionId");
CREATE INDEX "DialogueProfileEvent_turnId_idx" ON "DialogueProfileEvent"("turnId");
CREATE INDEX "DialogueProfileEvent_mode_idx" ON "DialogueProfileEvent"("mode");
CREATE INDEX "DialogueProfileEvent_scenarioId_idx" ON "DialogueProfileEvent"("scenarioId");
CREATE INDEX "DialogueProfileEvent_nodeId_idx" ON "DialogueProfileEvent"("nodeId");
CREATE INDEX "DialogueProfileEvent_type_idx" ON "DialogueProfileEvent"("type");
CREATE INDEX "DialogueProfileEvent_createdAt_idx" ON "DialogueProfileEvent"("createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
