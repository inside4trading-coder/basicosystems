update public.esp_fabrication_requests
set status = 'ready', updated_at = now()
where id = '2485dbd8-9700-4659-b9d8-d3516127531b'::uuid;