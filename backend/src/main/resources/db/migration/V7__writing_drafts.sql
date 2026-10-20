CREATE SCHEMA writing;
CREATE TABLE writing.draft (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL REFERENCES campaigns.campaign(id),
    card uuid NOT NULL UNIQUE,
    revision bigint NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    tags text NOT NULL,
    summary text NOT NULL,
    body text NOT NULL,
    path text NOT NULL
);
CREATE INDEX writing_draft_campaign ON writing.draft(campaign);
