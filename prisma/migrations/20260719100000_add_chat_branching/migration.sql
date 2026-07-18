-- Add persistent branch lineage without copying legacy message history.
CREATE TABLE "conversation_branches" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "parent_branch_id" TEXT,
    "fork_message_id" TEXT,
    "head_message_id" TEXT,
    "sibling_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversation_branches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversations" ADD COLUMN "active_branch_id" TEXT;
ALTER TABLE "messages" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "messages" ADD COLUMN "parent_message_id" TEXT;

-- Each existing conversation becomes a root branch. UUID text is generated without
-- requiring a database extension, keeping this migration deployable on Cloud SQL.
INSERT INTO "conversation_branches" ("id", "conversation_id", "sibling_order", "created_at", "updated_at")
SELECT md5(c."id" || c."created_at"::text || random()::text)::uuid::text, c."id", 0, c."created_at", c."updated_at"
FROM "conversations" c;

UPDATE "messages" m
SET "branch_id" = b."id"
FROM "conversation_branches" b
WHERE b."conversation_id" = m."conversation_id";

WITH ordered_messages AS (
    SELECT m."id", lag(m."id") OVER (PARTITION BY m."conversation_id" ORDER BY m."created_at", m."id") AS "parent_message_id"
    FROM "messages" m
)
UPDATE "messages" m
SET "parent_message_id" = o."parent_message_id"
FROM ordered_messages o
WHERE m."id" = o."id";

WITH branch_heads AS (
    SELECT DISTINCT ON (m."conversation_id") m."conversation_id", m."id"
    FROM "messages" m
    ORDER BY m."conversation_id", m."created_at" DESC, m."id" DESC
)
UPDATE "conversation_branches" b
SET "head_message_id" = h."id"
FROM branch_heads h
WHERE b."conversation_id" = h."conversation_id";

UPDATE "conversations" c
SET "active_branch_id" = b."id"
FROM "conversation_branches" b
WHERE b."conversation_id" = c."id";

ALTER TABLE "messages" ALTER COLUMN "branch_id" SET NOT NULL;

CREATE INDEX "conversation_branches_conversation_id_parent_branch_id_idx" ON "conversation_branches"("conversation_id", "parent_branch_id");
CREATE INDEX "conversation_branches_conversation_id_fork_message_id_sibling_order_idx" ON "conversation_branches"("conversation_id", "fork_message_id", "sibling_order");
CREATE UNIQUE INDEX "conversation_branches_unique_sibling_order" ON "conversation_branches"("conversation_id", "fork_message_id", "sibling_order") WHERE "fork_message_id" IS NOT NULL;
CREATE INDEX "messages_branch_id_idx" ON "messages"("branch_id");
CREATE INDEX "messages_parent_message_id_idx" ON "messages"("parent_message_id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_active_branch_id_fkey" FOREIGN KEY ("active_branch_id") REFERENCES "conversation_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_branches" ADD CONSTRAINT "conversation_branches_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_branches" ADD CONSTRAINT "conversation_branches_parent_branch_id_fkey" FOREIGN KEY ("parent_branch_id") REFERENCES "conversation_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_branches" ADD CONSTRAINT "conversation_branches_fork_message_id_fkey" FOREIGN KEY ("fork_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_branches" ADD CONSTRAINT "conversation_branches_head_message_id_fkey" FOREIGN KEY ("head_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "conversation_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
