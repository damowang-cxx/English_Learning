DROP INDEX IF EXISTS "DialogueEdge_fromNodeId_onResult_key";

ALTER TABLE "DialogueEdge" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DialogueEdge" ADD COLUMN "conditionJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "DialogueEdge" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DialogueEdge" ADD COLUMN "isFallback" BOOLEAN NOT NULL DEFAULT false;

UPDATE "DialogueEdge"
SET "label" = "onResult"
WHERE "label" = '';

CREATE INDEX "DialogueEdge_fromNodeId_idx" ON "DialogueEdge"("fromNodeId");
CREATE INDEX "DialogueEdge_fromNodeId_onResult_idx" ON "DialogueEdge"("fromNodeId", "onResult");
