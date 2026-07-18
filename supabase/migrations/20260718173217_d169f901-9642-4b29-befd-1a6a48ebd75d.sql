DO $$
DECLARE v_mov int; v_sum numeric; v_pend int; v_runs int; v_events int;
BEGIN
  SELECT count(*), coalesce(sum(amount),0) INTO v_mov, v_sum
    FROM core_fabrication_fund_movements
    WHERE movement_type IN (
      'sale_generated','sale_generated_non_restockable',
      'replacement_cost_adjustment','replacement_reclassification_out',
      'replacement_reclassification_in','external_supplier_payment');
  SELECT count(*) INTO v_pend FROM core_fabrication_fund_pending_items;
  SELECT count(*) INTO v_runs FROM core_fabrication_fund_runs;
  SELECT count(*) INTO v_events FROM core_replenishment_policy_events
    WHERE source_type = 'fabrication_fund_movement';
  RAISE NOTICE 'RESET PARTIDAS: movements=% sum_amount=% pending_items=% runs=% events=%',
    v_mov, v_sum, v_pend, v_runs, v_events;
END $$;

-- Borrar eventos de política originados en movimientos de partidas
DELETE FROM core_replenishment_policy_events
  WHERE source_type = 'fabrication_fund_movement';

-- Borrar movimientos generados por procesamiento de ventas/reemplazos/pagos externos
DELETE FROM core_fabrication_fund_movements
  WHERE movement_type IN (
    'sale_generated','sale_generated_non_restockable',
    'replacement_cost_adjustment','replacement_reclassification_out',
    'replacement_reclassification_in','external_supplier_payment');

-- Borrar pendientes y runs
DELETE FROM core_fabrication_fund_pending_items;
DELETE FROM core_fabrication_fund_runs;

-- Resetear saldos de fondos operativos base
UPDATE core_fabrication_funds
  SET available_amount = 0, updated_at = now()
  WHERE fund_type IN ('general','external_supplier','pending','non_restockable','replacement');