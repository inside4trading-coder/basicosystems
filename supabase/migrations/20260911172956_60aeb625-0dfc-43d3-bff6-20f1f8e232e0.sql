REVOKE EXECUTE ON FUNCTION public.sublime_open_cash_session(uuid, numeric, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sublime_register_cash_movement(uuid, text, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sublime_cash_session_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sublime_close_cash_session(uuid, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sublime_register_pos_sale(text, uuid, text, jsonb, jsonb, text, jsonb, text, text, numeric, text, text, text, uuid) FROM PUBLIC, anon;