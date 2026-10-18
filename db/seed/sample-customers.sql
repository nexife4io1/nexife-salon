-- Sample customers + past/upcoming appointments + payments for the "Mirror Magic" tenant.
-- Safe to re-run: customers are matched by phone, appointments are skipped once any sample ones exist.
--
-- Prerequisite: Mirror Magic must already have the sample services, i.e. run db/seed/sample-services.sql
-- with its slug first (section 2 there). Appointments use the tenant's FIRST branch (oldest by created_at);
-- staff is left empty. Money is in cents. If the tenant name differs, change the ILIKE below.

-- 1) Ten customers
INSERT INTO salon.customers (tenant_id, name, phone, phone_key, email, birthday, gender, notes)
SELECT te.id, v.name, v.phone, regexp_replace(v.phone, '[^0-9]', '', 'g'), v.email, v.birthday::date, v.gender::salon.customer_gender, v.notes
FROM salon.tenants te
CROSS JOIN (VALUES
  ('Sophia Mehta',     '+919845012345', 'sophia.mehta@example.com',   '1992-03-14', 'female', 'Prefers a senior stylist. Sensitive scalp.'),
  ('Marcus Johnson',   '+919812345678', 'marcus.j@example.com',       '1988-11-02', 'male',   'Fade every 3 weeks.'),
  ('Isabella Rao',     '+919723456789', 'isabella.rao@example.com',   '1985-07-21', 'female', 'Regular colour client. Allergic to ammonia-based dyes.'),
  ('Emma Knight',      '+919934567890', NULL,                         '1999-01-30', 'female', NULL),
  ('Liam Bennett',     '+919845678901', 'liam.bennett@example.com',   '1994-09-09', 'male',   'Likes beard trim with every haircut.'),
  ('Olivia Chen',      '+919756789012', 'olivia.chen@example.com',    '1990-12-05', 'female', 'Gel nails, prefers neutral shades.'),
  ('David Wilson',     '+919867890123', NULL,                         '1979-05-17', 'male',   'Monthly deep tissue massage.'),
  ('Ava Martinez',     '+919978901234', 'ava.martinez@example.com',   '2001-08-25', 'female', 'Bridal trial planned.'),
  ('Aarav Nair',       '+919889012345', 'aarav.nair@example.com',     '2015-04-12', 'male',   'Kids haircut, comes with parent.'),
  ('Priya Sharma',     '+919790123456', 'priya.sharma@example.com',   '1987-10-03', 'female', 'Facials and waxing package regular.')
) AS v(name, phone, email, birthday, gender, notes)
WHERE te.name ILIKE 'mirror magic'
ON CONFLICT (tenant_id, phone_key) WHERE phone_key IS NOT NULL DO NOTHING;

-- 2) Appointments (mostly completed and paid, plus a cancelled, a no-show and two upcoming) and their payments
WITH ctx AS (
  SELECT te.id AS tenant_id,
         (SELECT b.id FROM salon.branches b WHERE b.tenant_id = te.id ORDER BY b.created_at LIMIT 1) AS branch_id
  FROM salon.tenants te
  WHERE te.name ILIKE 'mirror magic'
    AND NOT EXISTS (SELECT 1 FROM salon.appointments a WHERE a.tenant_id = te.id AND a.notes LIKE 'Sample data%')
),
plan AS (
  SELECT ctx.tenant_id, ctx.branch_id, c.id AS customer_id, s.id AS service_id, s.price_cents,
         gen_random_uuid() AS appointment_id,
         (date_trunc('day', now()) + make_interval(days => v.days_from_today, hours => v.hour))::timestamptz AS starts_at,
         v.status::salon.appointment_status AS status, v.method::salon.payment_method AS method
  FROM ctx
  CROSS JOIN (VALUES
    -- phone,           service,                         day offset, hour, status,       payment method
    ('+919845012345', 'Women''s Haircut & Style',       -62, 11, 'completed', 'card'),
    ('+919845012345', 'Deep Conditioning Hair Spa',     -34, 15, 'completed', 'card'),
    ('+919845012345', 'Blow Dry & Styling',             -9,  12, 'completed', 'upi'),
    ('+919812345678', 'Men''s Haircut',                 -40, 10, 'completed', 'cash'),
    ('+919812345678', 'Beard Trim & Shape',             -19, 10, 'completed', 'cash'),
    ('+919723456789', 'Balayage',                       -28, 13, 'completed', 'card'),
    ('+919723456789', 'Root Touch-up',                  -6,  14, 'completed', 'upi'),
    ('+919934567890', 'Classic Facial',                 -15, 16, 'completed', 'upi'),
    ('+919845678901', 'Men''s Haircut',                 -21, 17, 'completed', 'cash'),
    ('+919756789012', 'Gel Manicure',                   -12, 11, 'completed', 'card'),
    ('+919756789012', 'Classic Pedicure',               -12, 12, 'completed', 'card'),
    ('+919867890123', 'Deep Tissue Massage',            -30, 18, 'completed', 'card'),
    ('+919867890123', 'Deep Tissue Massage',            -2,  18, 'completed', 'wallet'),
    ('+919790123456', 'Hydrating Facial',               -25, 15, 'completed', 'upi'),
    ('+919790123456', 'Full Arms Waxing',               -25, 16, 'completed', 'upi'),
    ('+919889012345', 'Kids Haircut',                   -14, 10, 'completed', 'cash'),
    ('+919978901234', 'Bridal Makeup',                  -45, 9,  'cancelled', 'other'),
    ('+919934567890', 'Eyebrow Threading',              -5,  16, 'no_show',   'other'),
    ('+919978901234', 'Party Makeup',                    3,  16, 'booked',    'other'),
    ('+919845678901', 'Beard Trim & Shape',              5,  11, 'booked',    'other')
  ) AS v(phone, service, days_from_today, hour, status, method)
  JOIN salon.customers c ON c.tenant_id = ctx.tenant_id AND c.phone_key = regexp_replace(v.phone, '[^0-9]', '', 'g')
  JOIN salon.services s ON s.tenant_id = ctx.tenant_id AND s.name = v.service
  WHERE ctx.branch_id IS NOT NULL
),
appts AS (
  INSERT INTO salon.appointments (id, tenant_id, branch_id, customer_id, service_id, starts_at, type, status, notes)
  SELECT appointment_id, tenant_id, branch_id, customer_id, service_id, starts_at, 'booking', status, 'Sample data'
  FROM plan
  RETURNING id
)
INSERT INTO salon.payments (tenant_id, branch_id, appointment_id, amount_cents, method, paid_at)
SELECT tenant_id, branch_id, appointment_id, price_cents, method, starts_at + interval '1 hour'
FROM plan
WHERE status = 'completed';

-- 3) Keep the stored visit count in step with completed appointments
UPDATE salon.customers c
SET visit_count = x.n
FROM (
  SELECT a.customer_id, count(*)::int AS n
  FROM salon.appointments a
  WHERE a.status = 'completed' AND a.notes LIKE 'Sample data%'
  GROUP BY a.customer_id
) x
WHERE c.id = x.customer_id;
