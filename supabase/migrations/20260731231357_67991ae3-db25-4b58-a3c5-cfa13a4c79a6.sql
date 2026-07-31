DO $$
DECLARE v_op uuid := 'f8254185-183c-4cd0-b961-6187545cf42a';
BEGIN
  EXECUTE format('CREATE TABLE public.core_production_scan_events_backup_reset_op000008_20260731 AS SELECT * FROM public.core_production_scan_events WHERE production_order_id = %L', v_op);
  EXECUTE format('CREATE TABLE public.core_production_unit_processes_backup_reset_op000008_20260731 AS SELECT p.* FROM public.core_production_unit_processes p JOIN public.core_production_units u ON u.id = p.production_unit_id WHERE u.production_order_id = %L', v_op);
  EXECUTE format('CREATE TABLE public.core_production_work_entries_backup_reset_op000008_20260731 AS SELECT * FROM public.core_production_work_entries WHERE production_order_id = %L', v_op);
  EXECUTE format('CREATE TABLE public.core_production_units_backup_reset_op000008_20260731 AS SELECT * FROM public.core_production_units WHERE production_order_id = %L', v_op);
  EXECUTE format('CREATE TABLE public.core_production_order_lines_backup_reset_op000008_20260731 AS SELECT * FROM public.core_production_order_lines WHERE production_order_id = %L', v_op);
  EXECUTE format('CREATE TABLE public.core_production_orders_backup_reset_op000008_20260731 AS SELECT * FROM public.core_production_orders WHERE id = %L', v_op);

  DELETE FROM public.core_payroll_work_entry_links
   WHERE work_entry_id IN (SELECT id FROM public.core_production_work_entries WHERE production_order_id = v_op);

  DELETE FROM public.core_production_work_entries WHERE production_order_id = v_op;
  DELETE FROM public.core_production_scan_events WHERE production_order_id = v_op;

  UPDATE public.core_production_unit_processes p
     SET status = 'pending',
         completed_at = NULL,
         completed_by_operator_id = NULL,
         scanned_by_user_id = NULL,
         notes = NULL,
         updated_at = now()
   FROM public.core_production_units u
  WHERE u.id = p.production_unit_id AND u.production_order_id = v_op;

  UPDATE public.core_production_units
     SET status = CASE WHEN print_count > 0 THEN 'printed' ELSE 'created' END,
         entered_inventory_at = NULL,
         entered_inventory_by = NULL,
         inventory_entry_source = NULL,
         updated_at = now()
   WHERE production_order_id = v_op;

  UPDATE public.core_production_order_lines
     SET quantity_completed = 0,
         quantity_pending = quantity_ordered,
         status = 'pending',
         updated_at = now()
   WHERE production_order_id = v_op;

  UPDATE public.core_production_orders
     SET completed_quantity = 0,
         pending_quantity = total_quantity,
         status = 'open',
         updated_at = now()
   WHERE id = v_op;

  INSERT INTO public.core_audit_logs (action, table_name, record_id, new_value)
  VALUES ('reset_op_progress', 'core_production_orders', v_op, 'OP-000008: escaneos y nomina eliminados, procesos y avance reseteados, unidades/QR conservadas');
END $$;