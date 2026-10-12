/* ============================================================
   PRRIP Riparian Land Cover - Random Forest classification
   SENSOR: Landsat 5 (TM)           YEARS: 2000, 2005, 2010
   Classes: 1=Water 2=Vegetation 3=Sand/Bare 4=Crops 5=Developed
   ------------------------------------------------------------
   Landsat 7 is not used (SLC-off gaps). The TM bands are renamed
   to the Landsat 8 names, so everything below STEP 3 is identical
   to the Landsat 8 script.
   To run another year in this era: set `year` and point `samples`
   at that year's uploaded training points.
   ============================================================ */

// ---------------- Assets (set to your paths) ----------------
var boundary = ee.FeatureCollection('users/YOU/prrip_boundary');       // study area
var samples  = ee.FeatureCollection('users/YOU/train_pts_RF5_2010');   // 5000 pts/class, field 'class'
var year     = 2010;                                                    // <-- change per year (2000, 2005, 2010)

var aoi = boundary;
Map.addLayer(aoi, {}, 'Study boundary');

// ---------------- STEP 1: Background RGB (visualization only) ----------------
var rgb = ee.ImageCollection('LANDSAT/LT05/C02/T1_TOA')
  .filterDate(year + '-01-01', year + '-12-31').filterBounds(aoi)
  .filter(ee.Filter.lt('CLOUD_COVER', 10)).median().clip(aoi);
Map.addLayer(rgb, {bands: ['B4','B3','B2'], min: 0, max: 0.4, gamma: [0.95,1.1,1]},
             'Landsat RGB', false);

// ---------------- STEP 2: Training points ----------------
var totalsamples = samples;
print('class counts', totalsamples.aggregate_histogram('class'));
print('one point', totalsamples.first());

// ---------------- STEP 3: Landsat 5 SR prep (scale + mask + rename to L8 names) ----------------
var start = ee.Date.fromYMD(year, 1, 1), end = ee.Date.fromYMD(year, 12, 31);

function scaleMask(img){
  // TM bands SR_B1..B5,B7 -> L8 names SR_B2..B7 so the rest of the script matches
  var sr = img.select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7'],
                      ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'])
              .multiply(0.0000275).add(-0.2).clamp(0, 1).toFloat();
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1).eq(0)            // fill
    .and(qa.bitwiseAnd(1 << 1).eq(0))          // dilated cloud
    .and(qa.bitwiseAnd(1 << 2).eq(0))          // cirrus (unused on TM, harmless)
    .and(qa.bitwiseAnd(1 << 3).eq(0))          // cloud
    .and(qa.bitwiseAnd(1 << 4).eq(0))          // cloud shadow
    .and(qa.bitwiseAnd(1 << 5).eq(0));         // snow
  return sr.updateMask(mask).updateMask(img.select('QA_RADSAT').eq(0))
           .copyProperties(img, img.propertyNames());
}

var col = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterBounds(aoi).filterDate(start, end).map(scaleMask);

// ---------------- STEP 4: Seasonal composites ----------------
var springC = col.filterDate(ee.Date.fromYMD(year,4,25), ee.Date.fromYMD(year,6,5));
var summerC = col.filterDate(ee.Date.fromYMD(year,6,25), ee.Date.fromYMD(year,8,25));
var fallC   = col.filterDate(ee.Date.fromYMD(year,9,10), ee.Date.fromYMD(year,10,25));
print('scenes sp/su/fa:', springC.size(), summerC.size(), fallC.size());
// NOTE: Landsat 5 has fewer passes - if a season shows 0-1 scenes, widen that window.

var springSR = springC.median().clip(aoi);
var summerSR = summerC.median().clip(aoi);
var fallSR   = fallC.median().clip(aoi);

// ---------------- STEP 5: Indices + texture ----------------
function addIndices(img){
  var ndvi = img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');   // NIR-Red
  var ndwi = img.normalizedDifference(['SR_B3','SR_B5']).rename('NDWI');   // Green-NIR
  var bsi  = img.expression('((S + R) - (N + B)) / ((S + R) + (N + B))',
    {S: img.select('SR_B6'), R: img.select('SR_B4'),
     N: img.select('SR_B5'), B: img.select('SR_B2')}).rename('BSI');
  var nbr  = img.normalizedDifference(['SR_B5','SR_B7']).rename('NBR');
  return img.addBands([ndvi, ndwi, bsi, nbr]);
}
function addNDVIglcm(img){
  var gl = img.select('NDVI').multiply(255).toByte().glcmTexture({size: 2});
  return img.addBands(gl.select(['NDVI_contrast','NDVI_ent','NDVI_asm']));
}
function suffixBands(img, s){
  return img.rename(img.bandNames().map(function(b){ return ee.String(b).cat('_').cat(s); }));
}
var spring = suffixBands(addIndices(springSR), 'sp');
var summer = suffixBands(addNDVIglcm(addIndices(summerSR)), 'su');
var fall   = suffixBands(addIndices(fallSR), 'fa');

// ---------------- STEP 6: NDVI amplitude (year-long phenology) ----------------
var ndviYear = col.map(function(img){ return img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI'); });
var ndviAmp = ndviYear.reduce(ee.Reducer.percentile([90]))
  .subtract(ndviYear.reduce(ee.Reducer.percentile([10]))).rename('NDVI_amp');

// ---------------- STEP 7: Feature image ----------------
var image = ee.Image.cat([spring, summer, fall, ndviAmp]).clip(aoi);
var bands = image.bandNames();
print('bands used', bands);

// ---------------- STEP 8: Sample features at the points ----------------
var training = image.select(bands).sampleRegions({
  collection: totalsamples, properties: ['class'], scale: 30, tileScale: 4});
print('training size', training.size());

// ---------------- STEP 9: Train / test split (80 / 20) ----------------
var withRandom = training.randomColumn('random', 42);
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.8));
var testSet  = withRandom.filter(ee.Filter.gte('random', 0.8));
print('train / test size', trainSet.size(), testSet.size());

// ---------------- STEP 10: Train Random Forest ----------------
var classifier = ee.Classifier.smileRandomForest(200).train({
  features: trainSet, classProperty: 'class', inputProperties: bands});

// ---------------- STEP 11: Classify + smooth ----------------
var classified = image.select(bands).classify(classifier);
var classified_smooth = classified.focal_mode({kernel: ee.Kernel.square(1), iterations: 1});

// ---------------- STEP 12: Accuracy on the held-out test set ----------------
var cm = testSet.classify(classifier).errorMatrix('class', 'classification');
print('Test error matrix', cm);
print('Test OA', cm.accuracy());
print('Test Kappa', cm.kappa());
print("Recall / Producer's", cm.producersAccuracy());
print("Precision / Consumer's", cm.consumersAccuracy());
print('F1 per class', cm.fscore());            // index = class value (1..5)
var f = cm.fscore();
print('Macro F1', ee.List([f.get(1), f.get(2), f.get(3), f.get(4), f.get(5)])
  .reduce(ee.Reducer.mean()));

// ---------------- STEP 13: Visualization ----------------
Map.setCenter(-100, 41, 9);
var palette = ['0000FF','008000','f7e084','90EE90','878f99']; // 1 Water 2 Veg 3 Sand 4 Crop 5 Dev
Map.addLayer(classified_smooth, {min: 1, max: 5, palette: palette}, 'Land cover ' + year);

// ---------------- STEP 14: Export classified map ----------------
Export.image.toDrive({
  image: classified_smooth, description: 'classified_' + year,
  region: aoi, scale: 30, crs: 'EPSG:32614', maxPixels: 1e13});

// ---------------- STEP 15: Class areas -> CSV ----------------
var areaFC = ee.FeatureCollection(ee.List(
  ee.Image.pixelArea().addBands(classified_smooth).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'code'}),
    geometry: aoi, scale: 30, maxPixels: 1e13}).get('groups'))
  .map(function(g){
    g = ee.Dictionary(g);
    return ee.Feature(null, {year: year, code: g.get('code'),
                             area_km2: ee.Number(g.get('sum')).divide(1e6)});
  }));
Export.table.toDrive({collection: areaFC, description: 'class_areas_' + year, fileFormat: 'CSV'});
