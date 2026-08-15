ALTER TABLE public.core_payroll_runs DROP CONSTRAINT IF EXISTS core_payroll_runs_status_chk;
ALTER TABLE public.core_payroll_runs ADD CONSTRAINT core_payroll_runs_status_chk CHECK (status = ANY (ARRAY['draft','review','approved','paid','cancelled','merged']));

ALTER TABLE public.core_payroll_runs
  ADD COLUMN IF NOT EXISTS merged_into_payroll_id uuid REFERENCES public.core_payroll_runs(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid,
  ADD COLUMN IF NOT EXISTS merged_reason text,
  ADD COLUMN IF NOT EXISTS merge_metadata jsonb,
  ADD COLUMN IF NOT EXISTS is_merged_period boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.core_merge_payrolls(
  p_target_payroll_id uuid,
  p_source_payroll_id uuid,
  p_reason text,
  p_confirm_unpaid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.core_payroll_runs%ROWTYPE;
  v_source public.core_payroll_runs%ROWTYPE;
  v_target_total_before numeric;
  v_proofs int := 0;
  v_line record;
  v_existing_line_id uuid;
  v_new_total numeric := 0;
  v_new_entries int := 0;
  v_new_operators int := 0;
  v_new_adjustments numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No tienes permisos para fusionar nóminas.');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El motivo de fusión es obligatorio.');
  END IF;

  IF p_target_payroll_id = p_source_payroll_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La nómina destino y origen no pueden ser la misma.');
  END IF;

  SELECT * INTO v_target FROM public.core_payroll_runs WHERE id = p_target_payroll_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nómina destino no encontrada.');
  END IF;

  SELECT * INTO v_source FROM public.core_payroll_runs WHERE id = p_source_payroll_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nómina origen no encontrada.');
  END IF;

  IF v_target.status IN ('merged','cancelled') OR v_source.status IN ('merged','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se puede fusionar una nómina cancelada o ya fusionada.');
  END IF;

  IF v_target.status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La nómina destino ya está pagada. No se puede fusionar sobre ella.');
  END IF;

  IF v_source.status = 'paid' THEN
    SELECT count(*) INTO v_proofs
    FROM public.core_payroll_payment_proofs
    WHERE payroll_run_id = v_source.id;

    IF v_proofs > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'La nómina origen tiene comprobantes de pago registrados. Requiere ajuste manual.');
    END IF;

    IF NOT COALESCE(p_confirm_unpaid, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'La nómina origen figura como pagada. Debes confirmar que no fue pagada realmente.');
    END IF;
  END IF;

  v_target_total_before := v_target.total_amount;

  -- Mover / fusionar líneas por operario
  FOR v_line IN
    SELECT * FROM public.core_payroll_operator_lines WHERE payroll_run_id = v_source.id
  LOOP
    SELECT id INTO v_existing_line_id
    FROM public.core_payroll_operator_lines
    WHERE payroll_run_id = v_target.id AND operator_id = v_line.operator_id
    LIMIT 1;

    IF v_existing_line_id IS NULL THEN
      UPDATE public.core_payroll_operator_lines
      SET payroll_run_id = v_target.id
      WHERE id = v_line.id;

      UPDATE public.core_payroll_work_entry_links
      SET payroll_run_id = v_target.id
      WHERE payroll_operator_line_id = v_line.id;
    ELSE
      UPDATE public.core_payroll_work_entry_links
      SET payroll_run_id = v_target.id,
          payroll_operator_line_id = v_existing_line_id
      WHERE payroll_operator_line_id = v_line.id;

      UPDATE public.core_payroll_adjustments
      SET payroll_operator_line_id = v_existing_line_id
      WHERE payroll_operator_line_id = v_line.id;

      UPDATE public.core_payroll_operator_lines t
      SET total_processes = t.total_processes + v_line.total_processes,
          subtotal_amount = t.subtotal_amount + v_line.subtotal_amount,
          adjustments_amount = COALESCE(t.adjustments_amount,0) + COALESCE(v_line.adjustments_amount,0),
          total_amount = t.total_amount + v_line.total_amount
      WHERE t.id = v_existing_line_id;

      DELETE FROM public.core_payroll_operator_lines WHERE id = v_line.id;
    END IF;
  END LOOP;

  -- Cualquier vínculo remanente del origen
  UPDATE public.core_payroll_work_entry_links
  SET payroll_run_id = v_target.id
  WHERE payroll_run_id = v_source.id;

  -- Recalcular destino desde los vínculos reales
  SELECT COALESCE(sum(amount),0), count(*), count(DISTINCT operator_id)
  INTO v_new_total, v_new_entries, v_new_operators
  FROM public.core_payroll_work_entry_links
  WHERE payroll_run_id = v_target.id;

  SELECT COALESCE(sum(COALESCE(adjustments_amount,0)),0)
  INTO v_new_adjustments
  FROM public.core_payroll_operator_lines
  WHERE payroll_run_id = v_target.id;

  UPDATE public.core_payroll_runs
  SET total_amount = v_new_total + v_new_adjustments,
      work_entries_count = v_new_entries,
      operators_count = v_new_operators,
      adjustments_total = v_new_adjustments,
      period_start = LEAST(v_target.period_start, v_source.period_start),
      period_end = GREATEST(v_target.period_end, v_source.period_end),
      is_merged_period = true,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_target.id;

  -- Marcar origen
  UPDATE public.core_payroll_runs
  SET status = 'merged',
      merged_into_payroll_id = v_target.id,
      merged_at = now(),
      merged_by = auth.uid(),
      merged_reason = btrim(p_reason),
      merge_metadata = jsonb_build_object(
        'original_total_amount', v_source.total_amount,
        'original_work_entries_count', v_source.work_entries_count,
        'original_operators_count', v_source.operators_count,
        'original_period_start', v_source.period_start,
        'original_period_end', v_source.period_end,
        'original_status', v_source.status,
        'original_payment_date', v_source.payment_date,
        'confirmed_unpaid', COALESCE(p_confirm_unpaid, false)
      ),
      total_amount = 0,
      work_entries_count = 0,
      operators_count = 0,
      adjustments_total = 0,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_source.id;

  INSERT INTO public.core_audit_logs (table_name, record_id, action, field_changed, old_value, new_value, performed_by)
  VALUES (
    'core_payroll_runs',
    v_source.id,
    'payroll_merged',
    'status',
    v_source.status,
    jsonb_build_object(
      'source_payroll_id', v_source.id,
      'source_payroll_code', v_source.payroll_code,
      'target_payroll_id', v_target.id,
      'target_payroll_code', v_target.payroll_code,
      'reason', btrim(p_reason),
      'confirmed_unpaid', COALESCE(p_confirm_unpaid, false),
      'source_original_total', v_source.total_amount,
      'source_original_entries', v_source.work_entries_count,
      'source_original_operators', v_source.operators_count,
      'source_original_period_start', v_source.period_start,
      'source_original_period_end', v_source.period_end,
      'target_total_before', v_target_total_before,
      'target_total_after', v_new_total + v_new_adjustments,
      'merged_at', now(),
      'merged_by', auth.uid()
    )::text,
    COALESCE(auth.uid()::text, 'system')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'target_payroll_code', v_target.payroll_code,
    'source_payroll_code', v_source.payroll_code,
    'total_amount', v_new_total + v_new_adjustments,
    'work_entries_count', v_new_entries,
    'operators_count', v_new_operators,
    'period_start', LEAST(v_target.period_start, v_source.period_start),
    'period_end', GREATEST(v_target.period_end, v_source.period_end)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.core_merge_payrolls(uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.core_merge_payrolls(uuid, uuid, text, boolean) TO authenticated;