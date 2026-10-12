# Platte River Riparian Land Cover — Random Forest

Land cover classification of the central Platte River (NE) from Landsat, using
Random Forest in Google Earth Engine. Training labels come from the 1 m PRRIP
land cover maps, resampled to 30 m. Goal: a consistent ~5-year land cover series
to relate channel and vegetation change to streamflow, precipitation, temperature.
Method after Chaulagain et al. (2023), *J. Arid Environ.* 219:105068.

## Classes
`1 = Water  2 = Vegetation  3 = Sand/Bare  4 = Crops  5 = Developed`

## GEE scripts (click to open)
Pick the script for the year's sensor, set `year`, point `samples` at that year's
uploaded points, and Run.

| Sensor | Years | Code Editor link |
|--------|-------|------------------|
| Landsat 5 | 2000, 2005, 2010 | _paste Get-Link URL_ |
| Landsat 8 | 2015, 2020 | _paste Get-Link URL_ |
| Landsat 8/9 | 2021+ (2025) | _paste Get-Link URL_ |

Archived copies are in `gee/`. (Landsat 7 not used — SLC-off gaps.)

## Workflow
**A. Labels (Python — `notebooks/PRRIP_Landcover_labels.ipynb`)**
1. Export each year from the PRRIP gdb → 1 m GeoTIFF.
2. Remap to 5 classes, resample to 30 m (majority).
3. Sample 5000 points/class → `train_pts_RF5_<year>.shp`.
4. Upload each to Earth Engine as a table asset.

**B. Classify (GEE)**
Open the sensor script → set `year` + `samples` → Run → check the **test** OA /
Kappa / F1 → export the map and per-class area CSV.

## Layout
```
notebooks/     label-building notebook
gee/           classify_landsat5 / 8 / 89 .js
data/samples/  training-point shapefiles (only small files committed)
```

## Notes to self
- Report the **held-out test** accuracy, not the classifier's own (resubstitution) matrix.
- Each year uses its **own** imagery + labels — never reuse labels across years.
- HR covers ~2000–2021; **1984 and 2025 have no HR**, so they use hand-digitized points.
- **2005** has no Water/Sand code in the source — treat those two classes with care.
- Landsat 5 years: check the printed scene counts per season; widen a window if 0–1.
- Keep the feature setup identical every year so trends are real, not method artifacts.

Needs: Python (`rasterio`, `numpy`, `fiona`, GDAL) and a GEE account.
