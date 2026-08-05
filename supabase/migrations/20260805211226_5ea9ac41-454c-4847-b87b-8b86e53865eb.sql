ALTER TABLE public.estudio_image_jobs
  ADD COLUMN IF NOT EXISTS model_photo_path text,
  ADD COLUMN IF NOT EXISTS uses_model_reference boolean NOT NULL DEFAULT false;

UPDATE public.estudio_prompt_presets SET output_size = '4:5' WHERE output_size = '1080x1350';
UPDATE public.estudio_prompt_presets SET output_size = '1:1' WHERE output_size = '1080x1080';
UPDATE public.estudio_prompt_presets SET output_size = '9:16' WHERE output_size = '1080x1920';

INSERT INTO public.estudio_motion_presets (name, prompt_text, default_duration_seconds, is_default)
SELECT v.name, v.prompt_text, v.dur, false
FROM (VALUES
  ('Campaña — Caminata hacia cámara',
   'La persona de la imagen camina lentamente hacia la cámara con paso natural y seguro, mirada al frente. Movimiento de cámara mínimo y estable. Mantén el rostro, el peinado, el tono de piel y el cuerpo exactamente como en la imagen inicial, sin deformaciones. La prenda debe conservar su corte, color, textura, estampado y cualquier texto sin alterarse en ningún fotograma. Iluminación y fondo consistentes durante todo el clip.',
   5),
  ('Campaña — Giro de cuerpo completo',
   'La persona gira lentamente 360 grados sobre su eje, en plano entero, para mostrar la prenda desde todos los ángulos. Movimiento fluido y continuo, cámara fija. Mantén el rostro, el peinado, el tono de piel y el cuerpo idénticos a la imagen inicial durante todo el giro, sin deformaciones al pasar por el perfil o la espalda. La prenda conserva corte, color, textura, estampado y texto sin cambios.',
   5),
  ('Campaña — Del detalle al plano entero',
   'El clip abre en primer plano sobre el detalle o estampado de la prenda y la cámara retrocede suavemente hasta revelar a la persona en plano entero. Movimiento de cámara lento y continuo, sin cortes. Mantén el rostro, el peinado, el tono de piel y el cuerpo exactamente como en la imagen inicial cuando aparecen en cuadro, sin deformaciones. La prenda conserva corte, color, textura, estampado y texto sin alterarse.',
   5)
) AS v(name, prompt_text, dur)
WHERE NOT EXISTS (
  SELECT 1 FROM public.estudio_motion_presets p WHERE p.name = v.name
);