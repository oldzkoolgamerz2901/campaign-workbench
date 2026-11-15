ALTER TABLE sharing.invitation ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sharing.invitation ADD CONSTRAINT sharing_invitation_id UNIQUE(id);
ALTER TABLE sharing.invitation ADD COLUMN invalidated_at timestamptz;
