CREATE TABLE sharing.card_content (
    campaign uuid NOT NULL,
    id uuid NOT NULL,
    visible jsonb NOT NULL,
    provenance jsonb NOT NULL,
    PRIMARY KEY (campaign,id)
);
CREATE TABLE sharing.card_artwork (
    campaign uuid NOT NULL,
    content uuid NOT NULL,
    variant text NOT NULL CHECK (variant IN ('DISPLAY','THUMBNAIL')),
    mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png')),
    width integer NOT NULL,
    height integer NOT NULL,
    bytes bytea NOT NULL,
    PRIMARY KEY (campaign,content,variant),
    FOREIGN KEY (campaign,content) REFERENCES sharing.card_content(campaign,id)
);
CREATE TABLE sharing.shared_card (
    campaign uuid NOT NULL,
    id uuid NOT NULL,
    content uuid NOT NULL,
    recipient uuid,
    mode text NOT NULL CHECK (mode IN ('HANDOUT','INVENTORY')),
    state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','DISCARDED','WITHDRAWN')),
    position bigint NOT NULL,
    PRIMARY KEY (campaign,id),
    FOREIGN KEY (campaign,content) REFERENCES sharing.card_content(campaign,id),
    FOREIGN KEY (campaign,recipient) REFERENCES sharing.player(campaign,id)
);
CREATE TABLE sharing.distribution (
    campaign uuid NOT NULL,
    operation uuid NOT NULL,
    parameters jsonb NOT NULL,
    card uuid NOT NULL,
    PRIMARY KEY (campaign,operation),
    FOREIGN KEY (campaign,card) REFERENCES sharing.shared_card(campaign,id)
);
CREATE TABLE sharing.card_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campaign uuid NOT NULL,
    card uuid NOT NULL,
    kind text NOT NULL,
    recipient uuid,
    occurred_at timestamptz NOT NULL,
    FOREIGN KEY (campaign,card) REFERENCES sharing.shared_card(campaign,id)
);
