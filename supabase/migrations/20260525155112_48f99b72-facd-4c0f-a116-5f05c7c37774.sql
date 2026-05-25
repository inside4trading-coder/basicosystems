
CREATE TRIGGER trg_core_raw_materials_updated_at
BEFORE UPDATE ON public.core_raw_materials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_core_raw_material_categories_updated_at
BEFORE UPDATE ON public.core_raw_material_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_core_units_of_measure_updated_at
BEFORE UPDATE ON public.core_units_of_measure
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS core_raw_materials_code_unique ON public.core_raw_materials (code);
