-- SQL Quiz: crop yield schema for Supabase (Postgres)
-- 1. Run this whole file in Supabase Dashboard -> SQL Editor.
-- 2. Then Table Editor -> pick each table -> Insert -> "Import data from CSV"
--    and upload the matching file from the cleaned/ folder.
-- Data source: Kaggle "Crop Yield Prediction Dataset" (patelris), from FAO + World Bank.
-- Countries use FAO names in every table, so tables join on (area, year).

drop table if exists yield, pesticides, rainfall, temp, yield_df;

-- Crop yield per country, crop and year (1961-2016)
create table yield (
  area_code        integer not null,
  area             text    not null,
  item_code        integer not null,
  item             text    not null,          -- crop name, e.g. 'Maize', 'Rice, paddy'
  year             integer not null,
  yield_hg_per_ha  integer not null,          -- hectograms per hectare
  primary key (area, item, year)
);

-- Total pesticide use per country and year (1990-2016)
create table pesticides (
  area               text    not null,
  year               integer not null,
  pesticides_tonnes  numeric not null,        -- tonnes of active ingredients
  primary key (area, year)
);

-- Average annual rainfall per country and year (1985-2017); NULL = not reported
create table rainfall (
  area             text    not null,
  year             integer not null,
  avg_rainfall_mm  numeric,
  primary key (area, year)
);

-- Average temperature per country and year (1743-2013), averaged across weather stations
create table temp (
  area        text    not null,
  year        integer not null,
  avg_temp_c  numeric not null,
  primary key (area, year)
);

-- Pre-joined table (1990-2013). Optional: handy as an answer key for join questions.
create table yield_df (
  area               text    not null,
  item               text    not null,
  year               integer not null,
  yield_hg_per_ha    integer not null,
  avg_rainfall_mm    numeric not null,
  pesticides_tonnes  numeric not null,
  avg_temp_c         numeric not null
);

-- Helpful indexes for joins on (area, year)
create index on yield (area, year);
create index on yield (item);

-- Read-only public access so the website can query with the anon key.
-- (Remove this block if you only want server-side access.)
alter table yield      enable row level security;
alter table pesticides enable row level security;
alter table rainfall   enable row level security;
alter table temp       enable row level security;
alter table yield_df   enable row level security;
create policy "public read" on yield      for select using (true);
create policy "public read" on pesticides for select using (true);
create policy "public read" on rainfall   for select using (true);
create policy "public read" on temp       for select using (true);
create policy "public read" on yield_df   for select using (true);
