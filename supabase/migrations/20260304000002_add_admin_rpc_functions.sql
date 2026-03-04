-- Admin RPC functions for dashboard overview
-- Both functions check is_admin before returning data

-- Command status counts
CREATE OR REPLACE FUNCTION admin_command_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_build_object(
      'pending',    COUNT(*) FILTER (WHERE status = 'pending'),
      'processing', COUNT(*) FILTER (WHERE status = 'processing'),
      'completed',  COUNT(*) FILTER (WHERE status = 'completed'),
      'failed',     COUNT(*) FILTER (WHERE status = 'failed')
    )
    FROM commands
  );
END;
$$;

-- Usage totals
CREATE OR REPLACE FUNCTION admin_usage_totals()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_cost', COALESCE(SUM(cost_usd), 0),
      'total_calls', COUNT(*),
      'period', 'all_time'
    )
    FROM ai_usage_logs
  );
END;
$$;
