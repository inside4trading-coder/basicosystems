CREATE OR REPLACE FUNCTION public.core_transfer_work_entry(
  p_work_entry_id uuid,
  p_new_operator_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.core_production_work_entries%ROWTYPE;
  v_linked boolean;
  v_op public.core_factory_operators%ROWTYPE;
  v_new_name text;
  v_prev_name text;
  v_user uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.has_role(v_user, 'manager'::app_role)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado para transferir trabajos de nómina.');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El motivo de transferencia es obligatorio.');
  END IF;

  SELECT * INTO v_entry
  FROM public.core_production_work_entries
  WHERE id = p_work_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Trabajo no encontrado.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.core_payroll_work_entry_links WHERE work_entry_id = p_work_entry_id
  ) INTO v_linked;

  IF v_linked OR v_entry.payroll_status NOT IN ('pending', 'missing_rate') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Este trabajo ya está en una nómina cerrada. Requiere ajuste manual.'
    );
  END IF;

  IF p_new_operator_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Debes seleccionar el nuevo operario.');
  END IF;

  IF v_entry.operator_id IS NOT DISTINCT FROM p_new_operator_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El nuevo operario debe ser distinto del actual.');
  END IF;

  SELECT * INTO v_op
  FROM public.core_factory_operators
  WHERE id = p_new_operator_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operario destino no encontrado.');
  END IF;

  IF v_op.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El operario destino no está activo.');
  END IF;

  v_new_name := btrim(coalesce(v_op.first_name, '') || ' ' || coalesce(v_op.last_name, ''));
  IF v_new_name = '' THEN v_new_name := coalesce(v_op.alias, 'Operario'); END IF;
  v_prev_name := coalesce(v_entry.operator_name_snapshot, 'Sin operario');

  UPDATE public.core_production_work_entries
  SET operator_id = p_new_operator_id,
      operator_name_snapshot = v_new_name,
      notes = btrim(
        coalesce(notes || E'\n', '') ||
        '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '] Transferencia de nómina: ' ||
        v_prev_name || ' → ' || v_new_name || '. Motivo: ' || btrim(p_reason)
      )
  WHERE id = p_work_entry_id;

  INSERT INTO public.core_audit_logs (table_name, record_id, action, field_changed, old_value, new_value, performed_by)
  VALUES (
    'core_production_work_entries',
    p_work_entry_id,
    'payroll_work_transfer',
    'operator_id',
    coalesce(v_entry.operator_id::text, 'null'),
    jsonb_build_object(
      'work_entry_id', p_work_entry_id,
      'unit_id', v_entry.production_unit_id,
      'unit_code', v_entry.unit_code,
      'process_id', v_entry.production_unit_process_id,
      'process_name', v_entry.process_name,
      'previous_operator_id', v_entry.operator_id,
      'previous_operator_name', v_prev_name,
      'new_operator_id', p_new_operator_id,
      'new_operator_name', v_new_name,
      'amount', v_entry.payroll_amount,
      'currency', coalesce(v_entry.currency, 'USD'),
      'reason', btrim(p_reason),
      'transferred_at', now(),
      'transferred_by', v_user
    )::text,
    coalesce(v_user::text, 'system')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'work_entry_id', p_work_entry_id,
    'previous_operator_id', v_entry.operator_id,
    'new_operator_id', p_new_operator_id,
    'new_operator_name', v_new_name,
    'amount', v_entry.payroll_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_transfer_work_entry(uuid, uuid, text) TO authenticated;