CREATE SCHEMA sources;
CREATE TABLE sources.capture (campaign uuid PRIMARY KEY, capture_id uuid NOT NULL, revision bigint NOT NULL);
CREATE TABLE sources.document (
    campaign uuid NOT NULL REFERENCES sources.capture(campaign), path text NOT NULL, content text NOT NULL,
    PRIMARY KEY (campaign, path)
);
