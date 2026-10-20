-- Crop Yield SQL Quiz: database schema (matches the live Supabase project).
--
-- Setup order:
--   1. Run this file in Supabase Dashboard -> SQL Editor.
--   2. Table Editor -> each table -> Insert -> "Import data from CSV", using the matching file in
--      datasets/cleaned/: yield.csv, pesticides.csv, rainfall.csv, temp.csv.
--      (Do NOT import yield_df.csv: yield_df is a view built from the four tables.)
--   3. Run supabase/run_quiz_sql.sql to add the function the website uses to run queries.
--
-- Data source: Kaggle "Crop Yield Prediction Dataset" (patelris), built from FAO and World Bank data.
-- Country names use FAO spelling in every table, so all tables join on (area, year).

drop view  if exists public.yield_df;
drop table if exists public.yield, public.pesticides, public.rainfall, public.temp;

-- Crop yield per country, crop and year (1961-2016). 56,717 rows.
create table public.yield (
  area_code        integer not null,
  area             text    not null,
  item_code        integer not null,
  item             text    not null,   -- crop name, e.g. 'Maize', 'Rice, paddy'
  year             integer not null,
  yield_hg_per_ha  integer not null,   -- hectograms per hectare
  primary key (area, item, year)
);

-- Total pesticide use per country and year (1990-2016). 4,349 rows.
create table public.pesticides (
  area               text    not null,
  year               integer not null,
  pesticides_tonnes  numeric not null, -- tonnes of active ingredients
  primary key (area, year)
);

-- Average annual rainfall per country and year (1985-2017). 6,727 rows; NULL = not reported (780 rows).
create table public.rainfall (
  area             text    not null,
  year             integer not null,
  avg_rainfall_mm  numeric,
  primary key (area, year)
);

-- Average temperature per country and year (1743-2013), averaged across weather stations. 27,479 rows.
create table public.temp (
  area        text    not null,
  year        integer not null,
  avg_temp_c  numeric not null,
  primary key (area, year)
);

create index on public.yield (area, year);
create index on public.yield (item);

-- The four tables joined on (area, year), 1990-2013. 15,610 rows.
create view public.yield_df with (security_invoker = true) as
select y.area, y.item, y.year, y.yield_hg_per_ha, r.avg_rainfall_mm, p.pesticides_tonnes, t.avg_temp_c
from public.yield y
join public.pesticides p using (area, year)
join public.rainfall r using (area, year)
join public.temp t using (area, year)
where r.avg_rainfall_mm is not null;

-- Row level security: everyone may read, nobody may insert/update/delete through the API.
alter table public.yield      enable row level security;
alter table public.pesticides enable row level security;
alter table public.rainfall   enable row level security;
alter table public.temp       enable row level security;
create policy "public read" on public.yield      for select using (true);
create policy "public read" on public.pesticides for select using (true);
create policy "public read" on public.rainfall   for select using (true);
create policy "public read" on public.temp       for select using (true);
