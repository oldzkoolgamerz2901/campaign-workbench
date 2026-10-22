CREATE SCHEMA playthroughs;
CREATE TABLE playthroughs.workspace (
    session uuid PRIMARY KEY REFERENCES preparation.session(id) ON DELETE CASCADE,
    revision bigint NOT NULL CHECK (revision >= 0),
    active text NOT NULL,
    used text NOT NULL
);
-- Disposable development state: no conversion or dual CardTable authority.
ALTER TABLE preparation.session DROP COLUMN card_table;
