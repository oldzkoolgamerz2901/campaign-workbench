CREATE TABLE playthroughs.play_note (
    id uuid PRIMARY KEY,
    session uuid NOT NULL REFERENCES preparation.session(id) ON DELETE CASCADE,
    operation uuid,
    state text NOT NULL,
    UNIQUE (session, operation)
);
CREATE INDEX play_note_session ON playthroughs.play_note(session);
