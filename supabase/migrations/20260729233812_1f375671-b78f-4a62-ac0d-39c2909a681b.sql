CREATE SCHEMA IF NOT EXISTS backup_reset_20260727;

CREATE TABLE backup_reset_20260727.core_production_units AS SELECT * FROM public.core_production_units;
CREATE TABLE backup_reset_20260727.core_production_unit_processes AS SELECT * FROM public.core_production_unit_processes;
CREATE TABLE backup_reset_20260727.core_production_scan_events AS SELECT * FROM public.core_production_scan_events;
CREATE TABLE backup_reset_20260727.core_production_unit_print_logs AS SELECT * FROM public.core_production_unit_print_logs;
CREATE TABLE backup_reset_20260727.core_production_orders AS SELECT * FROM public.core_production_orders;
CREATE TABLE backup_reset_20260727.core_production_order_lines AS SELECT * FROM public.core_production_order_lines;
CREATE TABLE backup_reset_20260727.core_production_order_processes AS SELECT * FROM public.core_production_order_processes;
CREATE TABLE backup_reset_20260727.core_production_order_need_links AS SELECT * FROM public.core_production_order_need_links;
CREATE TABLE backup_reset_20260727.core_production_needs AS SELECT * FROM public.core_production_needs;
CREATE TABLE backup_reset_20260727.core_production_need_sources AS SELECT * FROM public.core_production_need_sources;
CREATE TABLE backup_reset_20260727.core_production_work_entries AS SELECT * FROM public.core_production_work_entries;
CREATE TABLE backup_reset_20260727.core_payroll_work_entry_links AS SELECT * FROM public.core_payroll_work_entry_links;
CREATE TABLE backup_reset_20260727.core_replenishment_policy_events AS SELECT * FROM public.core_replenishment_policy_events;
CREATE TABLE backup_reset_20260727.core_fabrication_fund_movements AS SELECT * FROM public.core_fabrication_fund_movements;
CREATE TABLE backup_reset_20260727.core_fabrication_fund_pending_items AS SELECT * FROM public.core_fabrication_fund_pending_items;
CREATE TABLE backup_reset_20260727.core_fabrication_fund_runs AS SELECT * FROM public.core_fabrication_fund_runs;
CREATE TABLE backup_reset_20260727.core_fabrication_funds AS SELECT * FROM public.core_fabrication_funds;
CREATE TABLE backup_reset_20260727.core_external_purchase_orders AS SELECT * FROM public.core_external_purchase_orders;
CREATE TABLE backup_reset_20260727.core_external_purchase_order_lines AS SELECT * FROM public.core_external_purchase_order_lines;

REVOKE ALL ON SCHEMA backup_reset_20260727 FROM PUBLIC;