// Quiz content. Each question: prompt (HTML), points, hint SQL, and the expected result table.
window.QUIZ_TABLES = [
  {
    name: "yield",
    columns: "area_code, area, item_code, item, year, yield_hg_per_ha",
    note: "Crop yield per country, crop and year (1961–2016), in hectograms per hectare.",
  },
  {
    name: "pesticides",
    columns: "area, year, pesticides_tonnes",
    note: "Pesticide use per country and year (1990–2016).",
  },
  {
    name: "rainfall",
    columns: "area, year, avg_rainfall_mm",
    note: "Average annual rainfall (1985–2017). Some values are NULL.",
  },
  {
    name: "temp",
    columns: "area, year, avg_temp_c",
    note: "Average annual temperature (1743–2013).",
  },
  {
    name: "yield_df",
    columns: "area, item, year, yield_hg_per_ha, avg_rainfall_mm, pesticides_tonnes, avg_temp_c",
    note: "View: the four tables pre-joined (1990–2013). Not needed for any question.",
  },
];

window.QUIZ_QUESTIONS = [
  {
    id: "q1",
    title: "Crop overview",
    points: 3,
    skills: "COUNT · AVG · ROUND · GROUP BY · ORDER BY",
    prompt:
      "<p>For each crop (<code>item</code>) in the <code>yield</code> table, show the number of records and the average yield rounded to a whole number. Sort from highest to lowest average yield.</p>",
    sql: `SELECT item,
       COUNT(*) AS num_records,
       ROUND(AVG(yield_hg_per_ha)) AS avg_yield
FROM yield
GROUP BY item
ORDER BY avg_yield DESC;`,
    expected: {
      columns: ["item", "num_records", "avg_yield"],
      rows: [
        ["Potatoes", 7876, 150083],
        ["Cassava", 5718, 92769],
        ["Sweet potatoes", 6356, 89885],
        ["Plantains and others", 2654, 86283],
        ["Yams", 3150, 80904],
        ["Rice, paddy", 6469, 30239],
        ["Maize", 8631, 29360],
        ["Wheat", 6160, 24607],
        ["Sorghum", 5511, 17091],
        ["Soybeans", 4192, 14163],
      ],
    },
  },
  {
    id: "q2",
    title: "Maize and rainfall",
    points: 3,
    skills: "JOIN · WHERE · ORDER BY · LIMIT",
    prompt:
      "<p>Which 5 countries had the highest maize yield in 2013? Show each country, its maize yield, and its average rainfall that year.</p>",
    sql: `SELECT y.area,
       y.yield_hg_per_ha,
       r.avg_rainfall_mm
FROM yield y
JOIN rainfall r ON r.area = y.area AND r.year = y.year
WHERE y.item = 'Maize' AND y.year = 2013
ORDER BY y.yield_hg_per_ha DESC
LIMIT 5;`,
    expected: {
      columns: ["area", "yield_hg_per_ha", "avg_rainfall_mm"],
      rows: [
        ["United Arab Emirates", 367619, 78],
        ["Kuwait", 311478, 121],
        ["Saint Vincent and the Grenadines", 239583, 1583],
        ["Israel", 225559, 435],
        ["Jordan", 185326, 111],
      ],
    },
    note: "Four of the top five are very dry countries. Their maize is irrigated, so rainfall alone doesn't predict yield.",
  },
  {
    id: "q3",
    title: "Hottest countries",
    points: 3,
    skills: "WHERE · GROUP BY · HAVING",
    prompt:
      "<p>Using the <code>temp</code> table for the years 1990 through 2013, find the countries whose average temperature over that period was above 28&nbsp;°C. Show the country, how many years of data it has in that range, and the average temperature rounded to 2 decimals. Sort hottest first.</p>",
    sql: `SELECT area,
       COUNT(*) AS years,
       ROUND(AVG(avg_temp_c), 2) AS avg_temp
FROM temp
WHERE year >= 1990 AND year <= 2013
GROUP BY area
HAVING AVG(avg_temp_c) > 28
ORDER BY avg_temp DESC;`,
    expected: {
      columns: ["area", "years", "avg_temp"],
      rows: [
        ["Niger", 24, 29.72],
        ["Burkina Faso", 24, 28.74],
        ["Sudan", 24, 28.03],
      ],
    },
  },
  {
    id: "q4",
    title: "Pesticide leaders",
    points: 3,
    skills: "JOIN · SUM · AVG · LIMIT",
    prompt:
      "<p>Which 3 countries used the most pesticides <strong>in total</strong> from 1990 to 2016, and what was their average potato yield over the same years? Round both numbers to whole numbers.</p>",
    sql: `SELECT p.area,
       ROUND(SUM(p.pesticides_tonnes)) AS total_pesticides,
       ROUND(AVG(y.yield_hg_per_ha)) AS avg_potato_yield
FROM pesticides p
JOIN yield y ON y.area = p.area AND y.year = p.year
WHERE y.item = 'Potatoes'
GROUP BY p.area
ORDER BY total_pesticides DESC
LIMIT 3;`,
    expected: {
      columns: ["area", "total_pesticides", "avg_potato_yield"],
      rows: [
        ["China, mainland", 37194836, 146814],
        ["United States of America", 10978289, 417371],
        ["Brazil", 5671552, 206737],
      ],
    },
    note: "China uses over three times the pesticides of the US, yet the US potato yield is nearly three times higher.",
  },
  {
    id: "q5",
    title: "Climate groups",
    points: 4,
    skills: "WITH (CTE) · CASE · JOIN · HAVING",
    badge: "Requires a CTE",
    prompt: `<p>Classify every country by its <strong>average rainfall across all years</strong>:</p>
<ul>
  <li><code>Dry</code>: under 500 mm</li>
  <li><code>Moderate</code>: 500 mm up to (not including) 1500 mm</li>
  <li><code>Wet</code>: 1500 mm or more</li>
</ul>
<p>Ignore countries that have no rainfall data at all. Then, for each climate group, show how many countries reported a maize yield in 2013 and their average 2013 maize yield (rounded). Sort by average yield, highest first.</p>
<p><strong>Use at least one CTE (<code>WITH</code>).</strong></p>`,
    sql: `WITH country_rain AS (
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
ORDER BY avg_maize_yield DESC;`,
    expected: {
      columns: ["climate", "num_countries", "avg_maize_yield"],
      rows: [
        ["Dry", 37, 60508],
        ["Moderate", 74, 47497],
        ["Wet", 51, 37897],
      ],
    },
    note: "Common mistake: without HAVING COUNT(avg_rainfall_mm) > 0, Guam and New Caledonia (no rainfall data) fall into ELSE 'Wet', giving Wet = 53 countries and 37728.",
  },
  {
    id: "q6",
    title: "Top country per crop",
    points: 4,
    skills: "RANK · OVER · PARTITION BY · WITH",
    prompt:
      "<p>For each crop, find the country with the highest yield in 2016. Show the crop, the country, and the yield, sorted by crop name.</p>",
    sql: `WITH ranked AS (
    SELECT item, area, yield_hg_per_ha,
           RANK() OVER (PARTITION BY item ORDER BY yield_hg_per_ha DESC) AS rnk
    FROM yield
    WHERE year = 2016
)
SELECT item, area, yield_hg_per_ha
FROM ranked
WHERE rnk = 1
ORDER BY item;`,
    expected: {
      columns: ["item", "area", "yield_hg_per_ha"],
      rows: [
        ["Cassava", "Lao People's Democratic Republic", 326822],
        ["Maize", "Jordan", 404127],
        ["Plantains and others", "Suriname", 310250],
        ["Potatoes", "United States of America", 490203],
        ["Rice, paddy", "Australia", 102889],
        ["Sorghum", "Algeria", 255800],
        ["Soybeans", "Turkey", 43219],
        ["Sweet potatoes", "Senegal", 354370],
        ["Wheat", "Ireland", 95390],
        ["Yams", "Mali", 244423],
      ],
    },
  },
  {
    id: "bonus",
    title: "Bonus: worst US wheat years",
    points: 0,
    skills: "LAG · OVER · WITH",
    badge: "Not graded",
    prompt:
      "<p>Using <code>LAG</code>, find the 3 years with the largest year-over-year <strong>drop</strong> in US wheat yield (<code>area = 'United States of America'</code>). Show the year, the previous year's yield, that year's yield, and the change.</p>",
    sql: `WITH us AS (
    SELECT year, yield_hg_per_ha,
           LAG(yield_hg_per_ha) OVER (ORDER BY year) AS prev_yield
    FROM yield
    WHERE area = 'United States of America' AND item = 'Wheat'
)
SELECT year, prev_yield, yield_hg_per_ha,
       yield_hg_per_ha - prev_yield AS change
FROM us
ORDER BY change ASC
LIMIT 3;`,
    expected: {
      columns: ["year", "prev_yield", "yield_hg_per_ha", "change"],
      rows: [
        [1991, 26567, 23038, -3529],
        [2002, 27018, 23567, -3451],
        [1974, 21248, 18333, -2915],
      ],
    },
  },
];
