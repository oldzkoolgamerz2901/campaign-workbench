CREATE TABLE writing.image_original (
    owner_kind varchar(16) NOT NULL CHECK (owner_kind IN ('campaign', 'recovery')),
    owner_id uuid NOT NULL,
    hash varchar(64) NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
    mime varchar(32) NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
    width integer NOT NULL CHECK (width BETWEEN 1 AND 16384),
    height integer NOT NULL CHECK (height BETWEEN 1 AND 16384),
    byte_count integer NOT NULL CHECK (byte_count BETWEEN 1 AND 10485760),
    content bytea NOT NULL,
    PRIMARY KEY (owner_kind, owner_id, hash),
    CHECK (width::bigint * height <= 40000000),
    CHECK (octet_length(content) = byte_count)
);
CREATE TABLE writing.image_derivative (
    owner_kind varchar(16) NOT NULL,
    owner_id uuid NOT NULL,
    hash varchar(64) NOT NULL,
    policy integer NOT NULL CHECK (policy > 0),
    variant varchar(16) NOT NULL CHECK (variant IN ('DISPLAY','THUMBNAIL')),
    mime varchar(32) NOT NULL CHECK (mime IN ('image/jpeg','image/png')),
    width integer NOT NULL CHECK (width > 0),
    height integer NOT NULL CHECK (height > 0),
    content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 12582912),
    PRIMARY KEY (owner_kind, owner_id, hash, policy, variant),
    FOREIGN KEY (owner_kind, owner_id, hash) REFERENCES writing.image_original(owner_kind, owner_id, hash),
    CHECK ((variant = 'DISPLAY' AND width <= 1600 AND height <= 1600)
        OR (variant = 'THUMBNAIL' AND width <= 320 AND height <= 320))
);

CREATE TABLE preparation.image_original (
    owner_kind varchar(16) NOT NULL CHECK (owner_kind IN ('campaign')),
    owner_id uuid NOT NULL,
    hash varchar(64) NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
    mime varchar(32) NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
    width integer NOT NULL CHECK (width BETWEEN 1 AND 16384),
    height integer NOT NULL CHECK (height BETWEEN 1 AND 16384),
    byte_count integer NOT NULL CHECK (byte_count BETWEEN 1 AND 10485760),
    content bytea NOT NULL,
    PRIMARY KEY (owner_kind, owner_id, hash),
    CHECK (width::bigint * height <= 40000000),
    CHECK (octet_length(content) = byte_count)
);
CREATE TABLE preparation.image_derivative (
    owner_kind varchar(16) NOT NULL,
    owner_id uuid NOT NULL,
    hash varchar(64) NOT NULL,
    policy integer NOT NULL CHECK (policy > 0),
    variant varchar(16) NOT NULL CHECK (variant IN ('DISPLAY','THUMBNAIL')),
    mime varchar(32) NOT NULL CHECK (mime IN ('image/jpeg','image/png')),
    width integer NOT NULL CHECK (width > 0),
    height integer NOT NULL CHECK (height > 0),
    content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 12582912),
    PRIMARY KEY (owner_kind, owner_id, hash, policy, variant),
    FOREIGN KEY (owner_kind, owner_id, hash) REFERENCES preparation.image_original(owner_kind, owner_id, hash),
    CHECK ((variant = 'DISPLAY' AND width <= 1600 AND height <= 1600)
        OR (variant = 'THUMBNAIL' AND width <= 320 AND height <= 320))
);
