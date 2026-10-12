# Training sample points

Put the per-year training-point shapefiles here, one set per year:

```
train_pts_RF5_2000.shp  (.shx .dbf .prj .cpg)
train_pts_RF5_2005.shp  ...
train_pts_RF5_2010.shp
train_pts_RF5_2015.shp
train_pts_RF5_2020.shp
train_pts_2025.shp      (hand-digitized; no HR for 2025)
```

Each is 5000 random points per class on clean 30 m pixels, with a `class`
field (1=Water, 2=Vegetation, 3=Sand/Bare, 4=Crops, 5=Developed). They are
produced by the sampling cell in `notebooks/PRRIP_Landcover_labels.ipynb`.

Only these small shapefiles belong in the repo. The 1 m geodatabase, the 1 m
exports, and the 30 m label rasters are too large and are excluded by
`.gitignore`.
