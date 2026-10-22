ALTER TABLE playthroughs.workspace
    ADD COLUMN active_scene_item_id uuid,
    ADD COLUMN focused_item_ids text NOT NULL DEFAULT '[]';
