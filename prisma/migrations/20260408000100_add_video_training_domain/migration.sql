-- CreateTable
CREATE TABLE "VideoTrainingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL DEFAULT '',
    "plotSummary" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'video',
    "mediaUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoCaption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoTrainingItemId" TEXT NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "enText" TEXT NOT NULL,
    "zhText" TEXT,
    "speaker" TEXT,
    "isKeySentence" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    CONSTRAINT "VideoCaption_videoTrainingItemId_fkey" FOREIGN KEY ("videoTrainingItemId") REFERENCES "VideoTrainingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoTrainingItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "VideoCharacter_videoTrainingItemId_fkey" FOREIGN KEY ("videoTrainingItemId") REFERENCES "VideoTrainingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoPhraseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoTrainingItemId" TEXT NOT NULL,
    "captionId" TEXT,
    "phrase" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoPhraseNote_videoTrainingItemId_fkey" FOREIGN KEY ("videoTrainingItemId") REFERENCES "VideoTrainingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoPhraseNote_captionId_fkey" FOREIGN KEY ("captionId") REFERENCES "VideoCaption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoTrainingItem_createdAt_idx" ON "VideoTrainingItem"("createdAt");

-- CreateIndex
CREATE INDEX "VideoTrainingItem_tag_idx" ON "VideoTrainingItem"("tag");

-- CreateIndex
CREATE INDEX "VideoCaption_videoTrainingItemId_idx" ON "VideoCaption"("videoTrainingItemId");

-- CreateIndex
CREATE INDEX "VideoCaption_videoTrainingItemId_order_idx" ON "VideoCaption"("videoTrainingItemId", "order");

-- CreateIndex
CREATE INDEX "VideoCaption_speaker_idx" ON "VideoCaption"("speaker");

-- CreateIndex
CREATE INDEX "VideoCharacter_videoTrainingItemId_idx" ON "VideoCharacter"("videoTrainingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCharacter_videoTrainingItemId_name_key" ON "VideoCharacter"("videoTrainingItemId", "name");

-- CreateIndex
CREATE INDEX "VideoPhraseNote_videoTrainingItemId_idx" ON "VideoPhraseNote"("videoTrainingItemId");

-- CreateIndex
CREATE INDEX "VideoPhraseNote_captionId_idx" ON "VideoPhraseNote"("captionId");

-- CreateIndex
CREATE INDEX "VideoPhraseNote_userId_idx" ON "VideoPhraseNote"("userId");
