-- =====================================================
-- BECKET AI - BRIEF REWRITE (filtered for story quality)
-- Migration 050: generate_brief() per new artifact-driven rules
-- =====================================================
--
-- Filter rules locked in plan 2026-06-21:
--   type IN ('activity','friend_visit','appointment','manual')
--       → always include
--   type = 'school'
--       → include ONLY if an event_artifact exists for this child+event
--   type IN ('pickup','dropoff')
--       → never include (custody transitions are status, not story)
--
-- Window:
--   Caller can pass any p_since explicitly (e.g. today midnight for
--   "today" mode) and the function trusts it. When p_since IS NULL,
--   the function auto-derives the window as the last handoff where
--   reading parent was from_parent_id, then caps it at 5 days max.
--   The cap preserves the UX rule that the brief never looks more
--   than 5 days back — even if the parent hasn't done a handoff in
--   two weeks.
--
-- Return shape:
--   { since, child_id, had_handoff,
--     events: [ { event meta, artifacts: [...] } ],
--     last_handoff: { ... } }
--   `events` is a single array — each event carries its own artifacts.
--   The brief no longer separates "recent_snapshots" into their own
--   block; photos flow through artifact rows attached to events.
--   `had_handoff` is true only when the auto-derived path actually
--   found a handoff (false when fallback to 5-days-ago kicked in OR
--   when the caller passed p_since explicitly).

CREATE OR REPLACE FUNCTION generate_brief(
  p_child_id uuid,
  p_parent_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_since timestamptz;
  v_family_id uuid;
  v_had_handoff boolean := false;
BEGIN
  SELECT family_id INTO v_family_id
  FROM children
  WHERE id = p_child_id;

  IF p_since IS NULL THEN
    -- Auto-derive from last handoff where this parent dropped off.
    SELECT actual_at INTO v_since
    FROM handoffs
    WHERE child_id = p_child_id
      AND from_parent_id = p_parent_id
    ORDER BY actual_at DESC
    LIMIT 1;

    IF v_since IS NOT NULL THEN
      v_had_handoff := true;
    END IF;

    -- 5-day cap. Covers both "no handoff ever found" and "handoff was
    -- 8 days ago" in one branch — the brief never looks further back.
    IF v_since IS NULL OR v_since < NOW() - INTERVAL '5 days' THEN
      v_since := NOW() - INTERVAL '5 days';
    END IF;
  ELSE
    v_since := p_since;
  END IF;

  RETURN jsonb_build_object(
    'since', v_since,
    'child_id', p_child_id,
    'had_handoff', v_had_handoff,
    'events', (
      SELECT COALESCE(
        jsonb_agg(item ORDER BY (item->>'start_time')::timestamptz),
        '[]'::jsonb
      )
      FROM (
        SELECT jsonb_build_object(
          'event_id', e.id,
          'type', e.type,
          'title', e.title,
          'start_time', e.start_time,
          'end_time', e.end_time,
          'location_name', e.location_name,
          'status', e.status,
          'artifacts', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'photo_url', a.photo_url,
                'mood', a.mood,
                'note', a.note,
                'author_id', a.author_id,
                'author_label', fm.parent_label,
                'captured_at', a.captured_at
              ) ORDER BY a.captured_at
            ), '[]'::jsonb)
            FROM event_artifacts a
            LEFT JOIN family_members fm
              ON fm.profile_id = a.author_id
              AND fm.family_id = v_family_id
            WHERE a.event_id = e.id
              AND a.child_id = p_child_id
          )
        ) AS item
        FROM events e
        JOIN event_children ec ON ec.event_id = e.id
        WHERE ec.child_id = p_child_id
          AND e.family_id = v_family_id
          AND e.start_time >= v_since
          AND e.start_time <= NOW()
          AND e.status <> 'cancelled'
          AND (
            -- Always-include event types
            e.type IN ('activity', 'friend_visit', 'appointment', 'manual')
            OR
            -- School: only when ≥1 artifact exists for this child+event
            (e.type = 'school' AND EXISTS (
              SELECT 1 FROM event_artifacts a
              WHERE a.event_id = e.id AND a.child_id = p_child_id
            ))
            -- pickup / dropoff: implicitly excluded
          )
      ) sub
    ),
    'last_handoff', (
      SELECT jsonb_build_object(
        'from_parent', fm1.parent_label,
        'to_parent', fm2.parent_label,
        'actual_at', h.actual_at,
        'items_sent', h.items_sent
      )
      FROM handoffs h
      LEFT JOIN family_members fm1
        ON fm1.profile_id = h.from_parent_id AND fm1.family_id = v_family_id
      LEFT JOIN family_members fm2
        ON fm2.profile_id = h.to_parent_id AND fm2.family_id = v_family_id
      WHERE h.child_id = p_child_id
        AND h.actual_at <= NOW()
      ORDER BY h.actual_at DESC
      LIMIT 1
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;
