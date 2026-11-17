-- Existing distributed content was already readable. New commands choose explicitly.
ALTER TABLE sharing.shared_card ADD COLUMN back_revealed boolean NOT NULL DEFAULT true;
UPDATE sharing.distribution SET parameters = parameters || '{"revealBack":true}'::jsonb
WHERE NOT parameters ? 'revealBack';
