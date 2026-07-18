-- This migration was generated before the table-creation migration. In a
-- fresh/shadow replay the index does not exist yet, so leave it unchanged.
-- On databases where the index was already created under the old name, retain
-- the intended rename without requiring the branching table to exist first.
DO $$
BEGIN
  IF to_regclass('conversation_branches_conversation_id_fork_message_id_sibling_o') IS NOT NULL THEN
    ALTER INDEX "conversation_branches_conversation_id_fork_message_id_sibling_o"
      RENAME TO "conversation_branches_conversation_id_fork_message_id_sibli_idx";
  END IF;
END $$;
