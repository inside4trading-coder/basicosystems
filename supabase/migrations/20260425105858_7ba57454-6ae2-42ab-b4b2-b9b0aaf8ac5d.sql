ALTER TABLE public.recurring_tasks ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill sort_order based on creation order, per employee
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.recurring_tasks
)
UPDATE public.recurring_tasks t
SET sort_order = ranked.rn
FROM ranked
WHERE t.id = ranked.id AND t.sort_order = 0;

CREATE INDEX IF NOT EXISTS recurring_tasks_employee_order_idx
  ON public.recurring_tasks(employee_id, sort_order);