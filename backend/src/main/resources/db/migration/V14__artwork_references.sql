ALTER TABLE writing.draft ADD COLUMN image text, ADD COLUMN image_hash varchar(64);
ALTER TABLE writing.approved_revision ADD COLUMN image_hash varchar(64);
ALTER TABLE writing.export_artifact ADD COLUMN image_hash varchar(64);
ALTER TABLE preparation.item ADD COLUMN image text, ADD COLUMN image_hash varchar(64);
CREATE INDEX draft_image_reference ON writing.draft(campaign,image_hash);
CREATE INDEX approval_image_reference ON writing.approved_revision(campaign,image_hash);
CREATE INDEX export_image_reference ON writing.export_artifact(campaign,image_hash);
CREATE INDEX prepared_image_reference ON preparation.item(image_hash,session_id);
