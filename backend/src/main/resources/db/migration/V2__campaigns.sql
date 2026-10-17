CREATE SCHEMA campaigns;
CREATE TABLE campaigns.campaign (
    id uuid PRIMARY KEY, name text NOT NULL, directory text NOT NULL UNIQUE,
    include_patterns text NOT NULL, exclude_patterns text NOT NULL, revision bigint NOT NULL
);
CREATE TABLE campaigns.selection (id integer PRIMARY KEY CHECK (id = 1), campaign uuid REFERENCES campaigns.campaign(id));
