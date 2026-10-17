CREATE SCHEMA preparation;
CREATE TABLE preparation.session (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL REFERENCES campaigns.campaign(id),
    revision bigint NOT NULL,
    title varchar(200) NOT NULL,
    objective text NOT NULL,
    notes text NOT NULL
);
CREATE INDEX preparation_session_campaign ON preparation.session(campaign);
CREATE TABLE preparation.item (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES preparation.session(id) ON DELETE CASCADE,
    position integer,
    title text NOT NULL,
    markdown text NOT NULL,
    notes text NOT NULL,
    source_campaign uuid NOT NULL,
    capture uuid NOT NULL,
    path text NOT NULL,
    section text,
    document_hash varchar(64) NOT NULL,
    content_hash varchar(64) NOT NULL,
    UNIQUE(session_id, position) DEFERRABLE INITIALLY DEFERRED
);
