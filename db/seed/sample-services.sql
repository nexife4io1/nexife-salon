-- Sample salon service catalogue. Safe to re-run (skips names that already exist).
-- Prices are in cents (e.g. 4500 = 45.00). Run in the Supabase / Postgres SQL editor.

-- 1) Platform service templates (the catalogue the platform admin offers to tenants)
INSERT INTO salon.service_templates (name, category, audience, default_duration_minutes, default_price_cents)
SELECT v.name, v.category, v.audience::salon.service_audience, v.duration, v.price
FROM (VALUES
  -- Hair
  ('Women''s Haircut & Style',      'Hair',     'women',  60,  5500),
  ('Men''s Haircut',                'Hair',     'men',    30,  3000),
  ('Kids Haircut',                  'Hair',     'kids',   25,  2000),
  ('Beard Trim & Shape',            'Hair',     'men',    20,  1800),
  ('Blow Dry & Styling',            'Hair',     'women',  45,  3500),
  ('Full Head Colour',              'Hair',     'unisex', 120, 12000),
  ('Root Touch-up',                 'Hair',     'unisex', 75,  7000),
  ('Balayage',                      'Hair',     'women',  180, 22000),
  ('Highlights (Half Head)',        'Hair',     'unisex', 120, 14000),
  ('Keratin Smoothing Treatment',   'Hair',     'unisex', 150, 18000),
  ('Deep Conditioning Hair Spa',    'Hair',     'unisex', 60,  6000),
  ('Bridal Hair Updo',              'Hair',     'women',  90,  15000),
  -- Skin
  ('Classic Facial',                'Skin',     'unisex', 60,  6500),
  ('Hydrating Facial',              'Skin',     'unisex', 75,  8500),
  ('Anti-Ageing Facial',            'Skin',     'unisex', 90,  11000),
  ('Deep Cleansing Clean-up',       'Skin',     'unisex', 45,  4500),
  ('De-Tan Treatment',              'Skin',     'unisex', 45,  4000),
  -- Nails
  ('Classic Manicure',              'Nails',    'unisex', 40,  3000),
  ('Classic Pedicure',              'Nails',    'unisex', 50,  3800),
  ('Gel Manicure',                  'Nails',    'women',  50,  4500),
  ('Nail Art (per hand)',           'Nails',    'women',  30,  2500),
  -- Waxing & threading
  ('Full Arms Waxing',              'Waxing',   'women',  30,  2500),
  ('Full Legs Waxing',              'Waxing',   'women',  45,  3500),
  ('Eyebrow Threading',             'Waxing',   'unisex', 15,  800),
  ('Upper Lip Threading',           'Waxing',   'women',  10,  500),
  -- Massage & spa
  ('Head Massage',                  'Massage',  'unisex', 30,  2500),
  ('Swedish Full Body Massage',     'Massage',  'unisex', 60,  8000),
  ('Deep Tissue Massage',           'Massage',  'unisex', 60,  9000),
  ('Aromatherapy Massage',          'Massage',  'unisex', 75,  10000),
  -- Makeup
  ('Party Makeup',                  'Makeup',   'women',  60,  9000),
  ('Bridal Makeup',                 'Makeup',   'women',  120, 25000)
) AS v(name, category, audience, duration, price)
WHERE NOT EXISTS (SELECT 1 FROM salon.service_templates t WHERE t.name = v.name);

-- 2) OPTIONAL: give one salon (tenant) the whole catalogue and offer it at all of its branches.
--    Replace 'your-salon-slug' with the tenant's slug (SELECT slug FROM salon.tenants;).
INSERT INTO salon.services (tenant_id, template_id, name, category, audience, duration_minutes, price_cents)
SELECT te.id, t.id, t.name, t.category, t.audience, t.default_duration_minutes, t.default_price_cents
FROM salon.tenants te
CROSS JOIN salon.service_templates t
WHERE te.slug = 'your-salon-slug' AND t.active
ON CONFLICT (tenant_id, template_id) DO NOTHING;

INSERT INTO salon.branch_services (tenant_id, branch_id, service_id)
SELECT s.tenant_id, b.id, s.id
FROM salon.services s
JOIN salon.tenants te ON te.id = s.tenant_id AND te.slug = 'your-salon-slug'
JOIN salon.branches b ON b.tenant_id = s.tenant_id
ON CONFLICT (branch_id, service_id) DO NOTHING;
