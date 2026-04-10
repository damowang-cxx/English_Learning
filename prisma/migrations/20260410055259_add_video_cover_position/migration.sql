-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoTrainingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL DEFAULT '',
    "plotSummary" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'video',
    "mediaUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "coverPositionX" INTEGER NOT NULL DEFAULT 50,
    "coverPositionY" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoTrainingItem" ("coverUrl", "createdAt", "id", "mediaType", "mediaUrl", "plotSummary", "sourceTitle", "tag", "title", "updatedAt") SELECT "coverUrl", "createdAt", "id", "mediaType", "mediaUrl", "plotSummary", "sourceTitle", "tag", "title", "updatedAt" FROM "VideoTrainingItem";
DROP TABLE "VideoTrainingItem";
ALTER TABLE "new_VideoTrainingItem" RENAME TO "VideoTrainingItem";
CREATE INDEX "VideoTrainingItem_createdAt_idx" ON "VideoTrainingItem"("createdAt");
CREATE INDEX "VideoTrainingItem_tag_idx" ON "VideoTrainingItem"("tag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
