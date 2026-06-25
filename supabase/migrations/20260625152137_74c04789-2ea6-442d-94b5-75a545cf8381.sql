
-- Seed demo data for Fondo Transparente / Fuerza Venezuela
-- Tagged with [DEMO] in nota_interna for easy cleanup

-- 1) Ensure config / tasa del día
INSERT INTO fondo_configuracion (id, titulo_publico, subtitulo_publico, disclaimer, tasa_sugerida, tasa_ves_usd, tasa_fecha, tasa_fuente, tasa_actualizada_at)
VALUES (true,
        'fuerza venezuela',
        'fondo transparente de ayuda',
        'cada bolívar, dólar o usdt que entra al fondo se publica en esta página. cada gasto se publica con su comprobante.',
        45.50, 45.50, CURRENT_DATE, 'bcv', now())
ON CONFLICT (id) DO UPDATE
SET tasa_ves_usd = EXCLUDED.tasa_ves_usd,
    tasa_fecha = EXCLUDED.tasa_fecha,
    tasa_fuente = EXCLUDED.tasa_fuente,
    tasa_actualizada_at = now();

-- 2) APORTES de ejemplo (mezcla de estados y métodos)
INSERT INTO fondo_aportes
(fecha_reportada, fecha_confirmada, nombre_donante, nombre_publico, es_anonimo, metodo, moneda_original, monto_original, tasa_usada, equivalente_usd, referencia_privada, referencia_publica_enmascarada, estado, nota_publica, nota_interna)
VALUES
-- Confirmados Pago Móvil (VES)
(CURRENT_DATE - 6, now() - interval '5 days', 'María González', 'María G.', false, 'pago_movil', 'VES', 1820.00, 45.50, 40.00, '0102-12345678', '****5678', 'confirmado', 'gracias por la causa', '[DEMO] aporte demo 1'),
(CURRENT_DATE - 5, now() - interval '4 days', 'Anónimo', 'donante anónimo', true, 'pago_movil', 'VES', 910.00, 45.50, 20.00, '0102-87654321', '****4321', 'confirmado', NULL, '[DEMO] aporte demo 2'),
(CURRENT_DATE - 3, now() - interval '2 days', 'José Pérez', 'José P.', false, 'pago_movil', 'VES', 4550.00, 45.50, 100.00, '0134-11223344', '****3344', 'confirmado', 'para comida', '[DEMO] aporte demo 3'),

-- Confirmados Zelle (USD)
(CURRENT_DATE - 7, now() - interval '6 days', 'Carlos Ramírez', 'Carlos R.', false, 'zelle', 'USD', 50.00, NULL, 50.00, 'carlos@mail.com', 'c***@***.com', 'confirmado', 'fuerza venezuela', '[DEMO] aporte demo 4'),
(CURRENT_DATE - 2, now() - interval '1 day', 'Ana Torres', 'Ana T.', false, 'zelle', 'USD', 100.00, NULL, 100.00, 'ana@mail.com', 'a***@***.com', 'confirmado', NULL, '[DEMO] aporte demo 5'),

-- Confirmados Efectivo Sublime (USD)
(CURRENT_DATE - 4, now() - interval '3 days', 'Cliente tienda Sublime', 'tienda sublime', true, 'efectivo_sublime', 'USD', 25.00, NULL, 25.00, 'caja-sublime-001', 'caja sublime', 'confirmado', 'aporte en tienda', '[DEMO] aporte demo 6'),
(CURRENT_DATE - 1, now() - interval '12 hours', 'Cliente tienda Sublime', 'tienda sublime', true, 'efectivo_sublime', 'USD', 15.00, NULL, 15.00, 'caja-sublime-002', 'caja sublime', 'confirmado', NULL, '[DEMO] aporte demo 7'),

-- Confirmados Binance (USDT)
(CURRENT_DATE - 8, now() - interval '7 days', 'Luis M.', 'Luis M.', false, 'binance', 'USDT', 75.00, NULL, 75.00, 'TRX-abc123', 'TRX...c123', 'confirmado', 'desde madrid', '[DEMO] aporte demo 8'),
(CURRENT_DATE - 2, now() - interval '1 day', 'Diana V.', 'Diana V.', false, 'binance', 'USDT', 30.00, NULL, 30.00, 'TRX-def456', 'TRX...f456', 'confirmado', NULL, '[DEMO] aporte demo 9'),

-- Por verificar (pendientes)
(CURRENT_DATE, NULL, 'Pedro Salas', 'Pedro S.', false, 'pago_movil', 'VES', 2275.00, 45.50, 50.00, '0102-99887766', '****7766', 'por_verificar', NULL, '[DEMO] aporte demo 10'),
(CURRENT_DATE, NULL, 'Sofía L.', 'Sofía L.', false, 'zelle', 'USD', 40.00, NULL, 40.00, 'sofia@mail.com', 's***@***.com', 'por_verificar', NULL, '[DEMO] aporte demo 11'),
(CURRENT_DATE, NULL, 'Anónimo', 'donante anónimo', true, 'binance', 'USDT', 20.00, NULL, 20.00, 'TRX-ghi789', 'TRX...i789', 'por_verificar', NULL, '[DEMO] aporte demo 12');

-- 3) EGRESOS de ejemplo
INSERT INTO fondo_egresos
(fecha_gasto, categoria, descripcion, proveedor, moneda_original, monto_original, tasa_usada, equivalente_usd, estado, nota_publica, nota_interna, fecha_ejecucion)
VALUES
(CURRENT_DATE - 4, 'comida', 'compra de víveres - 20 bolsas alimentos básicos', 'Mercado popular Catia', 'VES', 2730.00, 45.50, 60.00, 'ejecutado', '20 bolsas de comida entregadas', '[DEMO] egreso demo 1', now() - interval '3 days'),
(CURRENT_DATE - 3, 'agua', 'botellones de agua potable - 15 unidades', 'Distribuidora Aqua', 'USD', 45.00, NULL, 45.00, 'ejecutado', '15 botellones distribuidos', '[DEMO] egreso demo 2', now() - interval '3 days'),
(CURRENT_DATE - 2, 'medicina', 'medicamentos básicos: paracetamol, antibióticos', 'Farmacia SAAS', 'USD', 80.00, NULL, 80.00, 'ejecutado', 'kit médico para 10 familias', '[DEMO] egreso demo 3', now() - interval '2 days'),
(CURRENT_DATE - 1, 'transporte', 'gasolina y transporte para reparto', 'Operador propio', 'VES', 910.00, 45.50, 20.00, 'ejecutado', 'reparto en 3 zonas', '[DEMO] egreso demo 4', now() - interval '1 day'),
(CURRENT_DATE, 'logistica', 'compra de bolsas, etiquetas y empaque', 'Plásticos CA', 'USDT', 15.00, NULL, 15.00, 'aprobado', NULL, '[DEMO] egreso demo 5 - aprobado pendiente ejecutar', NULL),
(CURRENT_DATE, 'refugio', 'apoyo arriendo refugio temporal familia damnificada', NULL, 'USD', 120.00, NULL, 120.00, 'pendiente', NULL, '[DEMO] egreso demo 6 - en revisión', NULL);
