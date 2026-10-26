-- New sole runtime authority. Old workspace rows are deliberately not read or converted.
-- Keep the unused legacy table intact; disposing of its rows requires separate approval.
CREATE TABLE playthroughs.tabletop_workspace (
    session uuid PRIMARY KEY REFERENCES preparation.session(id) ON DELETE CASCADE,
    revision bigint NOT NULL CHECK (revision >= 0),
    state text NOT NULL
);
