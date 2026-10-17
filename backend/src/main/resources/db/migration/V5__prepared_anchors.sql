CREATE TABLE preparation.anchor (
    item_id uuid NOT NULL REFERENCES preparation.item(id) ON DELETE CASCADE,
    original_anchor text NOT NULL,
    local_anchor text NOT NULL,
    PRIMARY KEY(item_id, original_anchor)
);
