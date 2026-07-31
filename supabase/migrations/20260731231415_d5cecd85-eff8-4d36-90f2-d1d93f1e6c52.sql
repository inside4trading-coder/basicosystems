DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'core_production_scan_events_backup_reset_op000008_20260731',
    'core_production_unit_processes_backup_reset_op000008_20260731',
    'core_production_work_entries_backup_reset_op000008_20260731',
    'core_production_units_backup_reset_op000008_20260731',
    'core_production_order_lines_backup_reset_op000008_20260731',
    'core_production_orders_backup_reset_op000008_20260731'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;