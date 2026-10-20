ALTER TABLE writing.draft ADD COLUMN origin text;
CREATE TABLE writing.export_artifact (
    id uuid PRIMARY KEY,
    campaign uuid NOT NULL REFERENCES campaigns.campaign(id),
    draft uuid NOT NULL REFERENCES writing.draft(id),
    revision bigint NOT NULL,
    created_at varchar(64) NOT NULL,
    payload text NOT NULL,
    summary text NOT NULL
);
CREATE INDEX writing_export_campaign_draft ON writing.export_artifact(campaign, draft);
