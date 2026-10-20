CREATE TABLE writing.approved_revision (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL REFERENCES campaigns.campaign(id),
    draft uuid NOT NULL,
    revision bigint NOT NULL CHECK (revision >= 0),
    payload text NOT NULL,
    UNIQUE (campaign, draft, revision)
);
ALTER TABLE preparation.item ALTER COLUMN capture DROP NOT NULL;
ALTER TABLE preparation.item ADD COLUMN origin_kind varchar(16) NOT NULL DEFAULT 'source';
ALTER TABLE preparation.item ADD COLUMN authored_origin text;
ALTER TABLE preparation.item ADD CONSTRAINT item_origin_variant CHECK (
    (origin_kind = 'source' AND capture IS NOT NULL AND authored_origin IS NULL) OR
    (origin_kind = 'authored' AND capture IS NULL AND authored_origin IS NOT NULL AND section IS NULL)
);
