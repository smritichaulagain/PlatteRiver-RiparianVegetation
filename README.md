# Platte River Riparian Land Cover — Random Forest

Land cover classification of the central Platte River (NE) from Landsat, using
Random Forest in Google Earth Engine. Training labels come from the 1 m PRRIP
land cover maps, resampled to 30 m. Goal: a consistent ~5-year land cover series
to relate channel and vegetation change to streamflow, precipitation, temperature.
Method after Chaulagain et al. (2023), *J. Arid Environ.* 219:105068.

## NOTES
- Each year uses its **own** imagery + labels — never reuse labels across years.
- HR covers ~2000–2021; **1984 and 2025 have no high resoultion land cover**, so they use hand-digitized points.
- **2005** has no Water/Sand code in the source — treat those two classes with care.
- For rest of the year where PRRIP classifed image were not available manual labeling were perfermed for each classes 
- Manual labeling were perfomed for 1984 and 2024, check if 1984 labels are representative for 1990 and 1995 and 2024 for 2025 classification

Overall for all years,classification has more than 80% overall capacity and Kappa coeffient is also over 0.8.
F1-score for each classes is higher than 0.9 for water, vegetation and crops classes, but developed and bare earth are within 0.7 to 0.85 due to spectral similarities.

## Classes
`1 = Water  2 = Vegetation  3 = Sand/Bare  4 = Crops  5 = Developed`

## GEE scripts (click to open)
Pick the script for the year's sensor, set `year`, point `samples` at that year's
uploaded points, and Run.

| Sensor | Years | Code Editor link |
|--------|-------|------------------|
| Landsat 5 | 1984, 1990, 1995 | https://code.earthengine.google.com/2e0fcf79c0db517ea1b71215aa222824 |
| Landsat 5 | 2000, 2005, 2010 | https://code.earthengine.google.com/4b20625aed3405bb81746b6589da9168 |
| Landsat 8 | 2015, 2020 | https://code.earthengine.google.com/6ea79a899e3027263c2865491b8c0527 |
| Landsat 8/9 | 2021+ (2025) | https://code.earthengine.google.com/2c60b1050f22237c753f6d6cc51205eb |

Archived copies are in `gee/`. (Landsat 7 not used — SLC-off gaps.)

## NDVI time series 
- NDVI summer vegetation stats, 1984–2025 (GEE): https://code.earthengine.google.com/25d0a2f42f01b2bf27abff3739399bbb


NDVI computed on vegetation only (NDVI > 0.2). Trend figures (boxplots) are in `ndvi/`.

## Workflow
**A. Labels (Python — `notebooks/PRRIP_Landcover_labels.ipynb`)**
1. Export each year from the PRRIP gdb → 1 m GeoTIFF from 1999 to 2021.
	PRRIP classified imager covers on managed river section that covers only 25% to 30 % of study reach
2. Remap to 5 classes, resample to 30 m (majority).
3. Sample 5000 points/class → `train_pts_RF5_<year>.shp`.
4. Upload each to Earth Engine as a table asset.

**B. Classify (GEE)**
Open the sensor script → set `year` + `samples` → Run → check the **test** OA /
Kappa / F1 → export the map and per-class area CSV.

## Layout
```
notebooks/     label-building notebook
gee/           classify_landsat5 / 8 / 89 .js  (+ ndvi_timeseries.js)
data/samples/  training-point shapefiles (only small files committed)
ndvi/          NDVI trend figures (PNG/JPG)
```



Needs: Python (`rasterio`, `numpy`, `fiona`, GDAL) and a GEE account.
