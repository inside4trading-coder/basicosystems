insert into public.estudio_enabled_models (model_id, kind, label, is_enabled) values
('bytedance-seed/seedream-5.0-lite','image','ByteDance Seed: Seedream 5.0 Lite',true),
('bytedance-seed/seedream-5.0-pro','image','ByteDance Seed: Seedream 5.0 Pro',true),
('bytedance-seed/seedream-4.5','image','ByteDance Seed: Seedream 4.5',true)
on conflict (model_id, kind) do update set label = excluded.label, is_enabled = true;

update public.estudio_enabled_models
set is_enabled = false
where kind = 'image'
  and model_id not in ('bytedance-seed/seedream-5.0-lite','bytedance-seed/seedream-5.0-pro','bytedance-seed/seedream-4.5');