-- CreateTable
CREATE TABLE "VideoCaptionNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoCaptionId" TEXT NOT NULL,
    "words" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoCaptionNote_videoCaptionId_fkey" FOREIGN KEY ("videoCaptionId") REFERENCES "VideoCaption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoCaptionNote_videoCaptionId_idx" ON "VideoCaptionNote"("videoCaptionId");

-- CreateIndex
CREATE INDEX "VideoCaptionNote_userId_idx" ON "VideoCaptionNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCaptionNote_videoCaptionId_userId_key" ON "VideoCaptionNote"("videoCaptionId", "userId");
