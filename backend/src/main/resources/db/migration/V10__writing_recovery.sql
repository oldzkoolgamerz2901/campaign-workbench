ALTER TABLE writing.draft ADD COLUMN recovery text;
CREATE TABLE writing.recovery_workspace (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    restored_at varchar(64) NOT NULL,
    drafts integer NOT NULL,
    approved integer NOT NULL,
    exports integer NOT NULL,
    payload text NOT NULL
);
