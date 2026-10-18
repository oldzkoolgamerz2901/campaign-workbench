-- Null preserves the rendering and archive interpretation of existing prepared material.
ALTER TABLE preparation.item ADD COLUMN captured_source text;
