CREATE TABLE sharing.pile (
    campaign uuid NOT NULL,
    id uuid NOT NULL,
    recipient uuid,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    position bigint NOT NULL,
    cover uuid,
    PRIMARY KEY (campaign,id),
    FOREIGN KEY (campaign,recipient) REFERENCES sharing.player(campaign,id)
);
ALTER TABLE sharing.shared_card ADD COLUMN pile uuid;
ALTER TABLE sharing.shared_card ADD CONSTRAINT shared_card_pile_fk
    FOREIGN KEY (campaign,pile) REFERENCES sharing.pile(campaign,id);
ALTER TABLE sharing.shared_card ADD CONSTRAINT inactive_card_without_pile CHECK (state='ACTIVE' OR pile IS NULL);
ALTER TABLE sharing.pile ADD CONSTRAINT pile_cover_fk
    FOREIGN KEY (campaign,cover) REFERENCES sharing.shared_card(campaign,id) DEFERRABLE INITIALLY DEFERRED;

-- Check both sides of membership at commit, allowing atomic recipient/placement changes.
CREATE FUNCTION sharing.check_pile_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM sharing.shared_card c JOIN sharing.pile p ON p.campaign=c.campaign AND p.id=c.pile
        WHERE c.campaign=NEW.campaign AND (c.state<>'ACTIVE' OR c.recipient IS DISTINCT FROM p.recipient)
    ) OR EXISTS (
        SELECT 1 FROM sharing.pile p LEFT JOIN sharing.shared_card c ON c.campaign=p.campaign AND c.id=p.cover
        WHERE p.campaign=NEW.campaign AND p.cover IS NOT NULL
          AND (c.id IS NULL OR c.state<>'ACTIVE' OR c.pile IS DISTINCT FROM p.id)
    ) THEN
        RAISE EXCEPTION 'Invalid sharing pile membership or cover';
    END IF;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER shared_card_membership AFTER INSERT OR UPDATE ON sharing.shared_card
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sharing.check_pile_membership();
CREATE CONSTRAINT TRIGGER pile_membership AFTER INSERT OR UPDATE ON sharing.pile
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sharing.check_pile_membership();
CREATE INDEX shared_card_location ON sharing.shared_card(campaign,recipient,pile,position) WHERE state='ACTIVE';
