REVOKE EXECUTE ON FUNCTION public.core_close_dispatch(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.core_receive_dispatch(uuid, uuid[], text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.core_close_dispatch(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_receive_dispatch(uuid, uuid[], text, text) TO authenticated, service_role;