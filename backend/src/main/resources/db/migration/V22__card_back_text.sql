ALTER TABLE writing.draft ADD COLUMN back_text text NOT NULL DEFAULT '';
ALTER TABLE writing.draft ADD COLUMN encoding integer NOT NULL DEFAULT 1;
