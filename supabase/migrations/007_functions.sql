-- =====================================================
-- BECKET AI - DATABASE FUNCTIONS
-- Migration 007: Helper functions for business logic
-- =====================================================

-- =====================================================
-- FUNCTION: Tag snapshot with most specific event
-- =====================================================
CREATE OR REPLACE FUNCTION tag_snapshot(
  p_family_id uuid,
  p_timestamp timestamptz
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Find most specific active event at timestamp
  -- Priority: friend_visit > appointment > activity > school > pickup/dropoff
  SELECT id INTO v_event_id
  FROM events
  WHERE family_id = p_family_id
    AND start_time <= p_timestamp
    AND end_time >= p_timestamp
    AND status != 'cancelled'
  ORDER BY
    CASE type
      WHEN 'friend_visit' THEN 1
      WHEN 'appointment' THEN 2
      WHEN 'activity' THEN 3
      WHEN 'school' THEN 4
      WHEN 'pickup' THEN 5
      WHEN 'dropoff' THEN 6
      ELSE 7
    END
  LIMIT 1;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: Get child timeline for date range
-- =====================================================
CREATE OR REPLACE FUNCTION child_timeline(
  p_child_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'events', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'type', e.type,
          'title', e.title,
          'start_time', e.start_time,
          'end_time', e.end_time,
          'status', e.status,
          'confirmed_at', e.confirmed_at
        )
        ORDER BY e.start_time
      )
      FROM events e
      JOIN event_children ec ON ec.event_id = e.id
      WHERE ec.child_id = p_child_id
        AND e.start_time::date >= p_from
        AND e.start_time::date <= p_to
    ),
    'handoffs', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'from_parent', fm1.parent_label,
          'to_parent', fm2.parent_label,
          'actual_at', h.actual_at,
          'items_sent', h.items_sent
        )
        ORDER BY h.actual_at
      )
      FROM handoffs h
      LEFT JOIN family_members fm1 ON fm1.profile_id = h.from_parent_id
      LEFT JOIN family_members fm2 ON fm2.profile_id = h.to_parent_id
      WHERE h.child_id = p_child_id
        AND h.actual_at::date >= p_from
        AND h.actual_at::date <= p_to
    ),
    'snapshots', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'file_url', s.file_url,
          'timestamp', s.timestamp,
          'caption', s.caption
        )
        ORDER BY s.timestamp
      )
      FROM snapshots s
      JOIN events e ON e.id = s.event_id
      JOIN event_children ec ON ec.event_id = e.id
      WHERE ec.child_id = p_child_id
        AND s.timestamp::date >= p_from
        AND s.timestamp::date <= p_to
    ),
    'expenses', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ex.id,
          'title', ex.title,
          'amount', ex.amount,
          'category', ex.category,
          'date', ex.date
        )
        ORDER BY ex.date
      )
      FROM expenses ex
      WHERE ex.child_id = p_child_id
        AND ex.date >= p_from
        AND ex.date <= p_to
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: Generate brief for parent
-- =====================================================
CREATE OR REPLACE FUNCTION generate_brief(
  p_child_id uuid,
  p_parent_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_since timestamptz;
  v_family_id uuid;
BEGIN
  -- Get family_id
  SELECT family_id INTO v_family_id
  FROM children
  WHERE id = p_child_id;

  -- If p_since is null, find last handoff where parent was "from_parent"
  IF p_since IS NULL THEN
    SELECT actual_at INTO v_since
    FROM handoffs
    WHERE child_id = p_child_id
      AND from_parent_id = p_parent_id
    ORDER BY actual_at DESC
    LIMIT 1;

    -- If no handoff found, default to 7 days ago
    IF v_since IS NULL THEN
      v_since := NOW() - INTERVAL '7 days';
    END IF;
  ELSE
    v_since := p_since;
  END IF;

  -- Build brief
  RETURN jsonb_build_object(
    'since', v_since,
    'child_id', p_child_id,
    'recent_events', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', e.type,
          'title', e.title,
          'start_time', e.start_time,
          'status', e.status
        )
        ORDER BY e.start_time DESC
      )
      FROM events e
      JOIN event_children ec ON ec.event_id = e.id
      WHERE ec.child_id = p_child_id
        AND e.start_time >= v_since
      LIMIT 10
    ),
    'recent_snapshots', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'file_url', s.file_url,
          'timestamp', s.timestamp,
          'caption', s.caption
        )
        ORDER BY s.timestamp DESC
      )
      FROM snapshots s
      JOIN events e ON e.id = s.event_id
      JOIN event_children ec ON ec.event_id = e.id
      WHERE ec.child_id = p_child_id
        AND s.timestamp >= v_since
      LIMIT 5
    ),
    'last_handoff', (
      SELECT jsonb_build_object(
        'from_parent', fm1.parent_label,
        'to_parent', fm2.parent_label,
        'actual_at', h.actual_at,
        'items_sent', h.items_sent
      )
      FROM handoffs h
      LEFT JOIN family_members fm1 ON fm1.profile_id = h.from_parent_id AND fm1.family_id = v_family_id
      LEFT JOIN family_members fm2 ON fm2.profile_id = h.to_parent_id AND fm2.family_id = v_family_id
      WHERE h.child_id = p_child_id
        AND h.actual_at >= v_since
      ORDER BY h.actual_at DESC
      LIMIT 1
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: Validate expense against understanding
-- =====================================================
CREATE OR REPLACE FUNCTION validate_expense(
  p_expense_id uuid
)
RETURNS void AS $$
DECLARE
  v_expense record;
  v_understanding record;
  v_category_rule jsonb;
  v_budget_limit jsonb;
  v_total_amount decimal;
  v_period_key text;
BEGIN
  -- Get expense
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;

  -- Find active understanding for this expense
  SELECT * INTO v_understanding
  FROM understandings
  WHERE family_id = v_expense.family_id
    AND (child_id = v_expense.child_id OR child_id IS NULL)
    AND category = 'expenses'
    AND status = 'active'
    AND valid_from <= v_expense.date
    AND (valid_until >= v_expense.date OR valid_until IS NULL)
  ORDER BY child_id NULLS LAST, valid_from DESC
  LIMIT 1;

  -- No understanding found
  IF NOT FOUND THEN
    UPDATE expenses
    SET status = 'pending_approval',
        requires_approval_reason = 'no_rule'
    WHERE id = p_expense_id;
    RETURN;
  END IF;

  -- Save understanding_id for audit
  UPDATE expenses SET understanding_id = v_understanding.id WHERE id = p_expense_id;

  -- Category is "other"
  IF v_expense.category = 'other' AND (v_understanding.expense_rules->>'other_requires_approval')::boolean THEN
    UPDATE expenses
    SET status = 'pending_approval',
        requires_approval_reason = 'category_other'
    WHERE id = p_expense_id;
    RETURN;
  END IF;

  -- Find category rule
  SELECT rule INTO v_category_rule
  FROM jsonb_array_elements(v_understanding.expense_rules->'categories') AS rule
  WHERE rule->>'name' = v_expense.category;

  IF NOT FOUND THEN
    -- Category not defined in understanding
    UPDATE expenses
    SET status = 'pending_approval',
        requires_approval_reason = 'no_rule'
    WHERE id = p_expense_id;
    RETURN;
  END IF;

  -- Extract budget limit
  v_budget_limit := v_category_rule->'budget_limit';

  -- Check budget if defined
  IF v_budget_limit IS NOT NULL AND v_budget_limit != 'null'::jsonb THEN
    IF v_budget_limit->>'period' = 'monthly' THEN
      v_period_key := TO_CHAR(v_expense.date, 'YYYY-MM');
    ELSE
      v_period_key := TO_CHAR(v_expense.date, 'YYYY');
    END IF;

    -- Get current total
    SELECT COALESCE(total_amount, 0) INTO v_total_amount
    FROM expense_budget_cache
    WHERE family_id = v_expense.family_id
      AND (child_id = v_expense.child_id OR (child_id IS NULL AND v_expense.child_id IS NULL))
      AND category = v_expense.category
      AND period_type = v_budget_limit->>'period'
      AND period_key = v_period_key;

    -- Check if adding this expense exceeds budget
    IF v_total_amount + v_expense.amount > (v_budget_limit->>'amount')::decimal THEN
      UPDATE expenses
      SET status = 'pending_approval',
          requires_approval_reason = 'exceeds_budget'
      WHERE id = p_expense_id;
      RETURN;
    END IF;
  END IF;

  -- All checks passed - approve and compute splits
  UPDATE expenses
  SET status = 'counted',
      split_dad_percent = (v_category_rule->>'dad_percent')::int,
      split_mom_percent = (v_category_rule->>'mom_percent')::int,
      split_dad_amount = v_expense.amount * (v_category_rule->>'dad_percent')::int / 100,
      split_mom_amount = v_expense.amount * (v_category_rule->>'mom_percent')::int / 100
  WHERE id = p_expense_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-validate expense on insert
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_expense()
RETURNS trigger AS $$
BEGIN
  PERFORM validate_expense(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_auto_validate
  AFTER INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_validate_expense();

-- =====================================================
-- FUNCTION: Check for missed pickups
-- =====================================================
CREATE OR REPLACE FUNCTION check_missed_pickups()
RETURNS void AS $$
DECLARE
  v_event record;
  v_existing_notification uuid;
BEGIN
  FOR v_event IN
    SELECT *
    FROM events
    WHERE type IN ('pickup', 'dropoff')
      AND status = 'scheduled'
      AND scheduled_time < NOW() - INTERVAL '15 minutes'
      AND confirmed_at IS NULL
  LOOP
    -- Check if we already sent initial notification
    SELECT id INTO v_existing_notification
    FROM notifications
    WHERE related_entity_type = 'event'
      AND related_entity_id = v_event.id
      AND type = 'pickup_missed'
      AND escalation_level = 0;

    IF NOT FOUND THEN
      -- Send initial notification to expected parent
      INSERT INTO notifications (
        family_id,
        recipient_id,
        type,
        category,
        title,
        message,
        priority,
        related_entity_type,
        related_entity_id,
        requires_action,
        escalation_level
      ) VALUES (
        v_event.family_id,
        v_event.expected_by,
        'pickup_missed',
        'handoff',
        v_event.type || ' not confirmed',
        'Please confirm ' || v_event.type || ' for ' || v_event.title,
        'urgent',
        'event',
        v_event.id,
        true,
        0
      );
    ELSE
      -- Check if 15 more minutes passed (30 min total) - escalate
      IF v_event.scheduled_time < NOW() - INTERVAL '30 minutes' THEN
        -- Check if escalation already sent
        SELECT id INTO v_existing_notification
        FROM notifications
        WHERE parent_notification_id = v_existing_notification
          AND escalation_level = 1;

        IF NOT FOUND THEN
          -- Send escalation to other parent
          INSERT INTO notifications (
            family_id,
            recipient_id,
            type,
            category,
            title,
            message,
            priority,
            related_entity_type,
            related_entity_id,
            escalation_level,
            parent_notification_id
          )
          SELECT
            v_event.family_id,
            fm.profile_id,
            'pickup_escalated',
            'handoff',
            'Check with co-parent',
            'Pickup not confirmed - please check with other parent',
            'high',
            'event',
            v_event.id,
            1,
            v_existing_notification
          FROM family_members fm
          WHERE fm.family_id = v_event.family_id
            AND fm.profile_id != v_event.expected_by
          LIMIT 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
