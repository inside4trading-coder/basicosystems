DO $do$
DECLARE
  r record;
  d text;
  nd text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN ('esp_resolve_fabrication_materials','esp_consume_materials_for_fabrication_request')
  LOOP
    d := pg_get_functiondef(r.oid);
    nd := replace(
      d,
      '(SELECT id FROM public.esp_locations WHERE type=''warehouse'' AND is_active=true ORDER BY created_at LIMIT 1)',
      '(SELECT id FROM public.esp_locations WHERE code=''ARTURO_SORIA'' AND is_active=true LIMIT 1)'
    );
    IF nd = d THEN
      RAISE EXCEPTION 'No se pudo aplicar el cambio de sede en la funcion %', r.oid::regprocedure;
    END IF;
    EXECUTE nd;
    n := n + 1;
  END LOOP;

  IF n <> 2 THEN
    RAISE EXCEPTION 'Se esperaban 2 funciones actualizadas, se actualizaron %', n;
  END IF;
END
$do$;