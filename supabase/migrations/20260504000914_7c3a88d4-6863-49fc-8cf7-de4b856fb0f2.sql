DROP VIEW IF EXISTS public.admin_instances_view;
CREATE VIEW public.admin_instances_view AS
SELECT
  i.id,
  i.obligation_id,
  i.period_label,
  i.due_date,
  i.amount,
  i.currency,
  i.status,
  i.paid_at,
  i.paid_by,
  i.payment_reference,
  i.payment_proof_url,
  i.notes,
  i.created_at,
  i.updated_at,
  o.name AS obligation_name,
  o.category,
  o.provider,
  o.frequency,
  o.importance,
  o.responsible,
  o.payment_method,
  public.get_urgency(i.due_date) AS urgency
FROM public.admin_instances i
JOIN public.admin_obligations o ON o.id = i.obligation_id;