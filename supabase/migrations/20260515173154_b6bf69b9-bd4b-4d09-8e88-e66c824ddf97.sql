
-- 1. Extend clock events
ALTER TABLE public.sublime_clock_events
  ADD COLUMN IF NOT EXISTS event_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS distance_meters numeric,
  ADD COLUMN IF NOT EXISTS allowed_radius_meters integer,
  ADD COLUMN IF NOT EXISTS location_state text NOT NULL DEFAULT 'ubicacion_no_disponible',
  ADD COLUMN IF NOT EXISTS clock_state text NOT NULL DEFAULT 'valido',
  ADD COLUMN IF NOT EXISTS punctuality_state text,
  ADD COLUMN IF NOT EXISTS device_user_agent text,
  ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Validation constraints (using triggers would also work; CHECK on enums is fine because lists are fixed)
ALTER TABLE public.sublime_clock_events
  DROP CONSTRAINT IF EXISTS sublime_clock_events_event_type_check;
ALTER TABLE public.sublime_clock_events
  ADD CONSTRAINT sublime_clock_events_event_type_check
  CHECK (event_type IN ('entrada','inicio_descanso','fin_descanso','salida'));

ALTER TABLE public.sublime_clock_events
  DROP CONSTRAINT IF EXISTS sublime_clock_events_location_state_check;
ALTER TABLE public.sublime_clock_events
  ADD CONSTRAINT sublime_clock_events_location_state_check
  CHECK (location_state IN (
    'dentro_del_radio','fuera_del_radio','gps_apagado',
    'permiso_denegado','ubicacion_imprecisa','ubicacion_no_disponible'
  ));

ALTER TABLE public.sublime_clock_events
  DROP CONSTRAINT IF EXISTS sublime_clock_events_clock_state_check;
ALTER TABLE public.sublime_clock_events
  ADD CONSTRAINT sublime_clock_events_clock_state_check
  CHECK (clock_state IN (
    'valido','pendiente_revision','rechazado','editado_manual','aprobado_manual'
  ));

CREATE INDEX IF NOT EXISTS idx_sublime_clock_events_emp_date
  ON public.sublime_clock_events (employee_id, event_date DESC);

-- 2. Daily shifts summary
CREATE TABLE IF NOT EXISTS public.sublime_daily_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  store_id uuid,
  shift_date date NOT NULL,
  real_entry_at timestamptz,
  real_exit_at timestamptz,
  late_minutes integer NOT NULL DEFAULT 0,
  break_minutes integer NOT NULL DEFAULT 0,
  gross_hours numeric(5,2) NOT NULL DEFAULT 0,
  net_hours numeric(5,2) NOT NULL DEFAULT 0,
  early_exit_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  final_state text NOT NULL DEFAULT 'incompleta',
  observations text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_date)
);

ALTER TABLE public.sublime_daily_shifts
  ADD CONSTRAINT sublime_daily_shifts_final_state_check
  CHECK (final_state IN (
    'completa','incompleta','tarde','salida_anticipada',
    'descanso_excedido','pendiente_revision','ausencia'
  ));

ALTER TABLE public.sublime_daily_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages daily shifts" ON public.sublime_daily_shifts;
CREATE POLICY "Admin manages daily shifts"
  ON public.sublime_daily_shifts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Manager reads daily shifts" ON public.sublime_daily_shifts;
CREATE POLICY "Manager reads daily shifts"
  ON public.sublime_daily_shifts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_sublime_daily_shifts_emp_date
  ON public.sublime_daily_shifts (employee_id, shift_date DESC);

CREATE OR REPLACE FUNCTION public.set_sublime_daily_shifts_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sublime_daily_shifts_updated_at ON public.sublime_daily_shifts;
CREATE TRIGGER trg_sublime_daily_shifts_updated_at
  BEFORE UPDATE ON public.sublime_daily_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_sublime_daily_shifts_updated_at();

-- 3. Function to (re)compute the daily shift for an employee/date.
-- Rules:
--   * Reads events of that day in chronological order.
--   * real_entry_at / real_exit_at = first entrada / last salida.
--   * break_minutes = sum(fin_descanso - inicio_descanso) pairs.
--   * gross_hours = exit - entry, net_hours = gross - break.
--   * late_minutes = max(0, real_entry - scheduled_entry - tolerance).
--   * early_exit_minutes = max(0, scheduled_exit - real_exit).
--   * overtime_minutes = max(0, real_exit - scheduled_exit).
--   * final_state derived: ausencia (no events), incompleta (no exit),
--     descanso_excedido (break > scheduled + 5 min tolerance),
--     tarde (late > 0), salida_anticipada (early_exit > 0),
--     pendiente_revision (any event with clock_state='pendiente_revision'),
--     completa (otherwise, has entry+exit).
CREATE OR REPLACE FUNCTION public.compute_sublime_daily_shift(
  p_employee_id uuid,
  p_date date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings record;
  v_entry timestamptz;
  v_exit timestamptz;
  v_store uuid;
  v_break_min int := 0;
  v_pair_start timestamptz;
  v_event record;
  v_late int := 0;
  v_early_exit int := 0;
  v_overtime int := 0;
  v_gross numeric(5,2) := 0;
  v_net numeric(5,2) := 0;
  v_pending boolean := false;
  v_state text;
  v_scheduled_entry timestamptz;
  v_scheduled_exit timestamptz;
BEGIN
  SELECT * INTO v_settings FROM sublime_clock_settings WHERE employee_id = p_employee_id;

  -- Gather events of that day, ordered
  FOR v_event IN
    SELECT * FROM sublime_clock_events
    WHERE employee_id = p_employee_id AND event_date = p_date
    ORDER BY event_at ASC
  LOOP
    IF v_event.clock_state = 'pendiente_revision' THEN
      v_pending := true;
    END IF;

    IF v_event.event_type = 'entrada' AND v_entry IS NULL THEN
      v_entry := v_event.event_at;
      v_store := COALESCE(v_event.store_id, v_store);
    ELSIF v_event.event_type = 'salida' THEN
      v_exit := v_event.event_at;
      v_store := COALESCE(v_event.store_id, v_store);
    ELSIF v_event.event_type = 'inicio_descanso' THEN
      v_pair_start := v_event.event_at;
    ELSIF v_event.event_type = 'fin_descanso' AND v_pair_start IS NOT NULL THEN
      v_break_min := v_break_min + GREATEST(0, EXTRACT(EPOCH FROM (v_event.event_at - v_pair_start))::int / 60);
      v_pair_start := NULL;
    END IF;
  END LOOP;

  IF v_settings.entry_time IS NOT NULL THEN
    v_scheduled_entry := (p_date::text || ' ' || v_settings.entry_time::text)::timestamptz;
  END IF;
  IF v_settings.exit_time IS NOT NULL THEN
    v_scheduled_exit := (p_date::text || ' ' || v_settings.exit_time::text)::timestamptz;
  END IF;

  IF v_entry IS NOT NULL AND v_scheduled_entry IS NOT NULL THEN
    v_late := GREATEST(0,
      EXTRACT(EPOCH FROM (v_entry - v_scheduled_entry))::int / 60
      - COALESCE(v_settings.late_tolerance_minutes, 0)
    );
  END IF;

  IF v_exit IS NOT NULL AND v_scheduled_exit IS NOT NULL THEN
    v_early_exit := GREATEST(0, EXTRACT(EPOCH FROM (v_scheduled_exit - v_exit))::int / 60);
    v_overtime  := GREATEST(0, EXTRACT(EPOCH FROM (v_exit - v_scheduled_exit))::int / 60);
  END IF;

  IF v_entry IS NOT NULL AND v_exit IS NOT NULL THEN
    v_gross := ROUND(EXTRACT(EPOCH FROM (v_exit - v_entry))::numeric / 3600, 2);
    v_net   := ROUND(GREATEST(0, EXTRACT(EPOCH FROM (v_exit - v_entry))::numeric / 60 - v_break_min) / 60, 2);
  END IF;

  -- Determine final state
  IF v_entry IS NULL AND v_exit IS NULL THEN
    v_state := 'ausencia';
  ELSIF v_pending THEN
    v_state := 'pendiente_revision';
  ELSIF v_exit IS NULL THEN
    v_state := 'incompleta';
  ELSIF v_settings.break_minutes IS NOT NULL
        AND v_break_min > v_settings.break_minutes + 5 THEN
    v_state := 'descanso_excedido';
  ELSIF v_late > 0 THEN
    v_state := 'tarde';
  ELSIF v_early_exit > 0 THEN
    v_state := 'salida_anticipada';
  ELSE
    v_state := 'completa';
  END IF;

  INSERT INTO sublime_daily_shifts (
    employee_id, store_id, shift_date,
    real_entry_at, real_exit_at,
    late_minutes, break_minutes,
    gross_hours, net_hours,
    early_exit_minutes, overtime_minutes,
    final_state, computed_at
  ) VALUES (
    p_employee_id, v_store, p_date,
    v_entry, v_exit,
    v_late, v_break_min,
    v_gross, v_net,
    v_early_exit, v_overtime,
    v_state, now()
  )
  ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    store_id = EXCLUDED.store_id,
    real_entry_at = EXCLUDED.real_entry_at,
    real_exit_at = EXCLUDED.real_exit_at,
    late_minutes = EXCLUDED.late_minutes,
    break_minutes = EXCLUDED.break_minutes,
    gross_hours = EXCLUDED.gross_hours,
    net_hours = EXCLUDED.net_hours,
    early_exit_minutes = EXCLUDED.early_exit_minutes,
    overtime_minutes = EXCLUDED.overtime_minutes,
    final_state = EXCLUDED.final_state,
    computed_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.compute_sublime_daily_shift(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compute_sublime_daily_shift(uuid, date) TO authenticated, service_role;

-- 4. Trigger: when an event is inserted/updated/deleted, recompute that day's shift.
CREATE OR REPLACE FUNCTION public.recompute_shift_on_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid;
  v_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.employee_id; v_date := OLD.event_date;
  ELSE
    v_emp := NEW.employee_id; v_date := NEW.event_date;
  END IF;
  PERFORM public.compute_sublime_daily_shift(v_emp, v_date);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sublime_clock_events_recompute ON public.sublime_clock_events;
CREATE TRIGGER trg_sublime_clock_events_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.sublime_clock_events
  FOR EACH ROW EXECUTE FUNCTION public.recompute_shift_on_event();
