-- CreateTable
CREATE TABLE "DialogueScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "userRole" TEXT NOT NULL DEFAULT '',
    "aiRole" TEXT NOT NULL DEFAULT '',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "coverUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "startNodeId" TEXT,
    "roleVoice" TEXT NOT NULL DEFAULT 'marin',
    "coachVoice" TEXT NOT NULL DEFAULT 'cedar',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DialogueNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "roleLineEn" TEXT NOT NULL,
    "roleLineZh" TEXT,
    "goal" TEXT NOT NULL,
    "rubricJson" TEXT NOT NULL DEFAULT '{}',
    "hintJson" TEXT NOT NULL DEFAULT '{}',
    "sampleAnswer" TEXT NOT NULL DEFAULT '',
    "retryLimit" INTEGER NOT NULL DEFAULT 2,
    "allowDynamicFollowup" BOOLEAN NOT NULL DEFAULT false,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DialogueNode_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DialogueScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DialogueEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "onResult" TEXT NOT NULL,
    "toNodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DialogueEdge_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DialogueScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "DialogueNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DialogueEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "DialogueNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DialogueSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
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

-- CreateTable
CREATE TABLE "DialogueAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "nodeId" TEXT,
    "userId" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'text',
    "userText" TEXT NOT NULL DEFAULT '',
    "transcriptText" TEXT,
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

-- CreateTable
CREATE TABLE "DialogueSpeechAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "audioUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DialogueScenario_isPublished_idx" ON "DialogueScenario"("isPublished");

-- CreateIndex
CREATE INDEX "DialogueScenario_difficulty_idx" ON "DialogueScenario"("difficulty");

-- CreateIndex
CREATE INDEX "DialogueScenario_createdAt_idx" ON "DialogueScenario"("createdAt");

-- CreateIndex
CREATE INDEX "DialogueNode_scenarioId_idx" ON "DialogueNode"("scenarioId");

-- CreateIndex
CREATE INDEX "DialogueNode_scenarioId_order_idx" ON "DialogueNode"("scenarioId", "order");

-- CreateIndex
CREATE INDEX "DialogueEdge_scenarioId_idx" ON "DialogueEdge"("scenarioId");

-- CreateIndex
CREATE INDEX "DialogueEdge_toNodeId_idx" ON "DialogueEdge"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "DialogueEdge_fromNodeId_onResult_key" ON "DialogueEdge"("fromNodeId", "onResult");

-- CreateIndex
CREATE INDEX "DialogueSession_scenarioId_idx" ON "DialogueSession"("scenarioId");

-- CreateIndex
CREATE INDEX "DialogueSession_userId_idx" ON "DialogueSession"("userId");

-- CreateIndex
CREATE INDEX "DialogueSession_status_idx" ON "DialogueSession"("status");

-- CreateIndex
CREATE INDEX "DialogueSession_lastActivityAt_idx" ON "DialogueSession"("lastActivityAt");

-- CreateIndex
CREATE INDEX "DialogueAttempt_sessionId_idx" ON "DialogueAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "DialogueAttempt_scenarioId_idx" ON "DialogueAttempt"("scenarioId");

-- CreateIndex
CREATE INDEX "DialogueAttempt_nodeId_idx" ON "DialogueAttempt"("nodeId");

-- CreateIndex
CREATE INDEX "DialogueAttempt_userId_idx" ON "DialogueAttempt"("userId");

-- CreateIndex
CREATE INDEX "DialogueAttempt_createdAt_idx" ON "DialogueAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DialogueSpeechAsset_cacheKey_key" ON "DialogueSpeechAsset"("cacheKey");

-- CreateIndex
CREATE INDEX "DialogueSpeechAsset_voice_idx" ON "DialogueSpeechAsset"("voice");

-- CreateIndex
CREATE INDEX "DialogueSpeechAsset_createdAt_idx" ON "DialogueSpeechAsset"("createdAt");
