# Crop Yield SQL Quiz (20 points)

**Topic:** Global crop yields and the conditions behind them (FAO / World Bank data via Kaggle).

**Tables**

| Table | Columns | Notes |
|---|---|---|
| `yield` | `area_code, area, item_code, item, year, yield_hg_per_ha` | Crop yield per country, crop, year (1961–2016). Yield in hectograms per hectare. |
| `pesticides` | `area, year, pesticides_tonnes` | Pesticide use per country, year (1990–2016). |
| `rainfall` | `area, year, avg_rainfall_mm` | Average annual rainfall (1985–2017). Some values are NULL. |
| `temp` | `area, year, avg_temp_c` | Average annual temperature (1743–2013). |
| `yield_df` | view | The four tables pre-joined (1990–2013). Not needed for any question. |

All tables join on `area` (country name) and `year`.

---

## Question 1 (3 points): Crop overview

For each crop (`item`) in the `yield` table, show the number of records and the average yield rounded to a whole number. Sort from highest to lowest average yield.

**Hint (clues)**
- Everything you need is in the `yield` table; no join needed.
- You want one row per crop, so `GROUP BY item`.
- `COUNT(*)` counts the records in each group; `AVG(yield_hg_per_ha)` averages the yield.
- Wrap the average in `ROUND(...)` with no second argument to get a whole number.
- Give the columns names with `AS` (e.g. `num_records`, `avg_yield`) and sort with `ORDER BY avg_yield DESC`.

**Answer: expected SQL**
```sql
SELECT item,
       COUNT(*) AS num_records,
       ROUND(AVG(yield_hg_per_ha)) AS avg_yield
FROM yield
GROUP BY item
ORDER BY avg_yield DESC;
```

**Answer: expected result (10 rows)**

| item | num_records | avg_yield |
|---|---|---|
| Potatoes | 7876 | 150083 |
| Cassava | 5718 | 92769 |
| Sweet potatoes | 6356 | 89885 |
| Plantains and others | 2654 | 86283 |
| Yams | 3150 | 80904 |
| Rice, paddy | 6469 | 30239 |
| Maize | 8631 | 29360 |
| Wheat | 6160 | 24607 |
| Sorghum | 5511 | 17091 |
| Soybeans | 4192 | 14163 |

---

## Question 2 (3 points): Maize and rainfall (JOIN)

Which 5 countries had the highest maize yield in 2013? Show each country, its maize yield, and its average rainfall that year.

**Hint (clues)**
- Yield is in `yield` and rainfall is in `rainfall`, so you need a `JOIN`.
- Match rows on **both** country and year: `ON r.area = y.area AND r.year = y.year`. Short table aliases (`y`, `r`) keep it readable.
- Filter in `WHERE`: the crop is `'Maize'` (text in single quotes, capital M) and the year is 2013.
- Sort by yield from highest to lowest and keep only the first 5 rows with `LIMIT`.

**Answer: expected SQL**
```sql
SELECT y.area,
       y.yield_hg_per_ha,
       r.avg_rainfall_mm
FROM yield y
JOIN rainfall r ON r.area = y.area AND r.year = y.year
WHERE y.item = 'Maize' AND y.year = 2013
ORDER BY y.yield_hg_per_ha DESC
LIMIT 5;
```

**Answer: expected result**

| area | yield_hg_per_ha | avg_rainfall_mm |
|---|---|---|
| United Arab Emirates | 367619 | 78 |
| Kuwait | 311478 | 121 |
| Saint Vincent and the Grenadines | 239583 | 1583 |
| Israel | 225559 | 435 |
| Jordan | 185326 | 111 |

*Talking point:* four of the top five are very dry countries. Their maize is irrigated, so rainfall alone doesn't predict yield.

---

## Question 3 (3 points): Hottest countries (HAVING)

Using the `temp` table for the years 1990 through 2013, find the countries whose average temperature over that period was above 28 °C. Show the country, how many years of data it has in that range, and the average temperature rounded to 2 decimals. Sort hottest first.

**Hint (clues)**
- Only the `temp` table is needed.
- Use `WHERE year >= 1990 AND year <= 2013` to keep the right years *before* grouping.
- `GROUP BY area` gives one row per country; `COUNT(*)` then counts its years.
- `WHERE` can't filter on an average. Use `HAVING AVG(avg_temp_c) > 28` to filter the groups.
- `ROUND(value, 2)` rounds to 2 decimals. Sort hottest first.

**Answer: expected SQL**
```sql
SELECT area,
       COUNT(*) AS years,
       ROUND(AVG(avg_temp_c), 2) AS avg_temp
FROM temp
WHERE year >= 1990 AND year <= 2013
GROUP BY area
HAVING AVG(avg_temp_c) > 28
ORDER BY avg_temp DESC;
```

**Answer: expected result**

| area | years | avg_temp |
|---|---|---|
| Niger | 24 | 29.72 |
| Burkina Faso | 24 | 28.74 |
| Sudan | 24 | 28.03 |

---

## Question 4 (3 points): Pesticide leaders (JOIN + aggregate)

Which 3 countries used the most pesticides **in total** from 1990 to 2016, and what was their average potato yield over the same years? Round both numbers to whole numbers.

**Hint (clues)**
- Join `pesticides` to `yield` on both `area` and `year`.
- Keep only potato rows with `WHERE y.item = 'Potatoes'`. Each country-year then appears once, so the pesticide total isn't counted once per crop.
- `GROUP BY` the country, then use `SUM(...)` for total pesticides and `AVG(...)` for potato yield, each inside `ROUND(...)`.
- Sort by the pesticide total, highest first, and keep 3 rows.

**Answer: expected SQL**
```sql
SELECT p.area,
       ROUND(SUM(p.pesticides_tonnes)) AS total_pesticides,
       ROUND(AVG(y.yield_hg_per_ha)) AS avg_potato_yield
FROM pesticides p
JOIN yield y ON y.area = p.area AND y.year = p.year
WHERE y.item = 'Potatoes'
GROUP BY p.area
ORDER BY total_pesticides DESC
LIMIT 3;
```

**Answer: expected result**

| area | total_pesticides | avg_potato_yield |
|---|---|---|
| China, mainland | 37194836 | 146814 |
| United States of America | 10978289 | 417371 |
| Brazil | 5671552 | 206737 |

*Talking point:* China uses over three times the pesticides of the US, yet the US potato yield is nearly three times higher.

---

## Question 5 (4 points): Climate groups (CTE + CASE)  ★ requires CTE

Classify every country by its **average rainfall across all years**:
- `Dry`: under 500 mm
- `Moderate`: 500 mm up to (not including) 1500 mm
- `Wet`: 1500 mm or more

Ignore countries that have no rainfall data at all. Then, for each climate group, show how many countries reported a maize yield in 2013 and their average 2013 maize yield (rounded). Sort by average yield, highest first.

Use at least one CTE (`WITH`).

**Hint (clues)**
- Work in steps. One `WITH` can hold several named queries separated by commas: `WITH step1 AS (...), step2 AS (...) SELECT ...`.
- Step 1: average rainfall per country from `rainfall` (`GROUP BY area`).
- `AVG` skips NULLs, but a country whose rainfall is *all* NULL ends up with a NULL average. `COUNT(column)` also skips NULLs, so `HAVING COUNT(avg_rainfall_mm) > 0` removes those countries.
- Step 2: label each country with `CASE WHEN ... THEN 'Dry' WHEN ... THEN 'Moderate' ELSE 'Wet' END`. The first `WHEN` that matches wins, so check the smallest range first.
- Final step: join your labelled countries to `yield` on `area`, keep maize in 2013, then `GROUP BY` the climate label.

**Answer: expected SQL**
```sql
WITH country_rain AS (
    SELECT area, AVG(avg_rainfall_mm) AS avg_rain
    FROM rainfall
    GROUP BY area
    HAVING COUNT(avg_rainfall_mm) > 0      -- drops countries whose rainfall is all NULL
),
classified AS (
    SELECT area,
           CASE WHEN avg_rain < 500  THEN 'Dry'
                WHEN avg_rain < 1500 THEN 'Moderate'
                ELSE 'Wet'
           END AS climate
    FROM country_rain
)
SELECT c.climate,
       COUNT(*) AS num_countries,
       ROUND(AVG(y.yield_hg_per_ha)) AS avg_maize_yield
FROM classified c
JOIN yield y ON y.area = c.area
WHERE y.item = 'Maize' AND y.year = 2013
GROUP BY c.climate
ORDER BY avg_maize_yield DESC;
```

**Answer: expected result**

| climate | num_countries | avg_maize_yield |
|---|---|---|
| Dry | 37 | 60508 |
| Moderate | 74 | 47497 |
| Wet | 51 | 37897 |

*Common mistake:* without the `HAVING COUNT(avg_rainfall_mm) > 0` line, Guam and New Caledonia (no rainfall data) fall into `ELSE 'Wet'`, giving Wet = 53 countries and 37728.

---

## Question 6 (4 points): Top country per crop (RANK + PARTITION BY)

For each crop, find the country with the highest yield in 2016. Show the crop, the country, and the yield, sorted by crop name.

**Hint (clues)**
- Keep only 2016 rows from `yield`.
- `RANK() OVER (PARTITION BY item ORDER BY yield_hg_per_ha DESC)` numbers the countries 1, 2, 3, ... separately for each crop.
- You can't use a window function in the `WHERE` of the same query. Compute the rank in a CTE, then select from the CTE `WHERE` the rank is 1.
- Sort the final rows by crop name.

**Answer: expected SQL**
```sql
WITH ranked AS (
    SELECT item, area, yield_hg_per_ha,
           RANK() OVER (PARTITION BY item ORDER BY yield_hg_per_ha DESC) AS rnk
    FROM yield
    WHERE year = 2016
)
SELECT item, area, yield_hg_per_ha
FROM ranked
WHERE rnk = 1
ORDER BY item;
```

**Answer: expected result (10 rows, no ties)**

| item | area | yield_hg_per_ha |
|---|---|---|
| Cassava | Lao People's Democratic Republic | 326822 |
| Maize | Jordan | 404127 |
| Plantains and others | Suriname | 310250 |
| Potatoes | United States of America | 490203 |
| Rice, paddy | Australia | 102889 |
| Sorghum | Algeria | 255800 |
| Soybeans | Turkey | 43219 |
| Sweet potatoes | Senegal | 354370 |
| Wheat | Ireland | 95390 |
| Yams | Mali | 244423 |

---

## Bonus / alternate (not counted): Worst wheat years in the US (LAG)

Using `LAG`, find the 3 years with the largest year-over-year **drop** in US wheat yield.

**Hint (clues)**
- In a CTE, keep only US wheat rows (`area = 'United States of America'`, `item = 'Wheat'`).
- `LAG(yield_hg_per_ha) OVER (ORDER BY year)` returns the previous year's yield on each row.
- The change is this year's yield minus the previous year's. A drop is a negative number, so the biggest drops sort first with `ORDER BY change ASC`.
- The first year has no previous year, so its change is NULL. When sorting ascending, Postgres puts NULLs last.

**Answer**

```sql
WITH us AS (
    SELECT year, yield_hg_per_ha,
           LAG(yield_hg_per_ha) OVER (ORDER BY year) AS prev_yield
    FROM yield
    WHERE area = 'United States of America' AND item = 'Wheat'
)
SELECT year, prev_yield, yield_hg_per_ha,
       yield_hg_per_ha - prev_yield AS change
FROM us
ORDER BY change ASC
LIMIT 3;
```

| year | prev_yield | yield_hg_per_ha | change |
|---|---|---|---|
| 1991 | 26567 | 23038 | -3529 |
| 2002 | 27018 | 23567 | -3451 |
| 1974 | 21248 | 18333 | -2915 |

---

**Points:** 3 + 3 + 3 + 3 + 4 + 4 = **20**
