-- Operational setup schema only; domain schemas arrive with their owning modules.
CREATE TABLE installation (
    id integer PRIMARY KEY CHECK (id = 1),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO installation (id) VALUES (1);
