-- Aggregate-owned value survives ordered item row replacement; endpoints are validated under the campaign lock.
ALTER TABLE preparation.session ADD COLUMN scene_links text NOT NULL DEFAULT '[]';
