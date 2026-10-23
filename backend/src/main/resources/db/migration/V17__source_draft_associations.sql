ALTER TABLE writing.draft DROP CONSTRAINT draft_card_key;
ALTER TABLE writing.draft ADD CONSTRAINT draft_campaign_card_key UNIQUE (campaign, card);

CREATE TABLE writing.source_association (
    campaign uuid NOT NULL REFERENCES campaigns.campaign(id),
    card uuid NOT NULL,
    path text NOT NULL,
    declared_id uuid,
    capture uuid NOT NULL,
    hash varchar(64) NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY (campaign, card)
);
