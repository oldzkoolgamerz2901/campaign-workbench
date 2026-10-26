-- Exact ISO Instant chronology, including nanoseconds and extended signed years.
-- Numeric arrays compare lexicographically; no timestamp cast truncates precision.
CREATE FUNCTION playthroughs.note_time(value text) RETURNS numeric[]
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT ARRAY[m[1]::numeric, m[2]::numeric, m[3]::numeric,
                 m[4]::numeric, m[5]::numeric, m[6]::numeric]
    FROM regexp_match(value, '^([+-]?[0-9]+)-([0-9]+)-([0-9]+)T([0-9]+):([0-9]+):([0-9.]+)Z$') AS m
$$;
CREATE INDEX play_note_resource_history ON playthroughs.play_note (
    ((state::jsonb #>> '{note,campaign}')),
    ((state::jsonb #>> '{note,resource,reference,campaign}')),
    ((state::jsonb #>> '{note,resource,reference,card}')),
    playthroughs.note_time(state::jsonb #>> '{note,createdAt}') DESC, id DESC
);
CREATE INDEX play_note_scene_history ON playthroughs.play_note (
    ((state::jsonb #>> '{note,campaign}')),
    ((state::jsonb #>> '{note,scene,reference,campaign}')),
    ((state::jsonb #>> '{note,scene,reference,card}')),
    playthroughs.note_time(state::jsonb #>> '{note,createdAt}') DESC, id DESC
);
