CREATE SCHEMA sharing;

CREATE TABLE sharing.player (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL,
    display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
    active boolean NOT NULL,
    UNIQUE (campaign, id)
);

CREATE TABLE sharing.invitation (
    campaign uuid NOT NULL,
    player uuid NOT NULL,
    token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
    consumed_at timestamptz,
    PRIMARY KEY (campaign, token_hash),
    FOREIGN KEY (campaign, player) REFERENCES sharing.player(campaign, id)
);

CREATE TABLE sharing.device (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL,
    player uuid NOT NULL,
    credential_hash text NOT NULL CHECK (credential_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    revoked_at timestamptz,
    UNIQUE (campaign, credential_hash),
    FOREIGN KEY (campaign, player) REFERENCES sharing.player(campaign, id)
);
CREATE INDEX sharing_device_player ON sharing.device(campaign, player);
