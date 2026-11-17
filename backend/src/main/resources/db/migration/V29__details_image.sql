ALTER TABLE writing.draft ADD COLUMN details_image text;
ALTER TABLE writing.draft ADD COLUMN details_image_hash text;
ALTER TABLE writing.approved_revision ADD COLUMN details_image_hash text;
ALTER TABLE writing.export_artifact ADD COLUMN details_image_hash text;
ALTER TABLE preparation.item ADD COLUMN details_image text;
ALTER TABLE preparation.item ADD COLUMN details_image_hash text;
ALTER TABLE sharing.card_artwork ADD COLUMN role text NOT NULL DEFAULT 'FRONT' CHECK (role IN ('FRONT','DETAILS'));
ALTER TABLE sharing.card_artwork DROP CONSTRAINT card_artwork_pkey;
ALTER TABLE sharing.card_artwork ADD PRIMARY KEY (campaign,content,role,variant);
