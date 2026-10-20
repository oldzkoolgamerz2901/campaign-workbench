-- Immutable exports own a complete snapshot and outlive the mutable working draft.
ALTER TABLE writing.export_artifact DROP CONSTRAINT export_artifact_draft_fkey;
