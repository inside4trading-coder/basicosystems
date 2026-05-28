UPDATE public.core_woo_write_logs
SET status = 'failed',
    error_message = 'stale_preview: stock_before=0 desactualizado vs Woo real=2. Marcado caducado para regeneración.',
    response_payload = jsonb_build_object('real_stock_before', 2, 'preview_stock_before', 0, 'auto_regenerated', true, 'manual_cleanup', true)
WHERE id = '1eeb6abc-da56-4618-ba4b-2378f6a79fc7'
  AND status = 'preview';