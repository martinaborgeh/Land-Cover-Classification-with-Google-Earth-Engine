var studyArea = ghanadata.filter(ee.Filter.eq('DISTRICT','Builsa'));



/*-------Filtering data-------*/
var sentinel_2A=ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
.filterBounds(studyArea)
.filterDate('2017-01-01','2017-12-31')
.filterMetadata("CLOUDY_PIXEL_PERCENTAGE","less_than",10)
.sort('CLOUDY_PIXEL_PERCENTAGE')
.median()
.clip(studyArea)
print(sentinel_2A,"FILTERED IMAGE")
var visualization ={gain:'0.1 ,0.1 ,0.1',scale:0}

Map.centerObject(studyArea);
Map.addLayer(sentinel_2A.select("B4","B3","B2"),visualization,'True_colour_sentinel_2A')


var training_points = vegetation.merge(settlement).merge(waterarea).merge(bareland)
print(training_points, 'training_points')
var Bands_selection=["B4","B3","B2"];
//overlay

var training =sentinel_2A.select(Bands_selection).sampleRegions({
  collection:training_points,
  properties:['landcover'],
  scale:10
})


print(training,"training")
Export.table.toAsset({
  collection: training,
  description: 'trainingasset',
  assetId: 'trainingasset'
});


///SPLITS:Training(75%) & Testing samples(25%).
var Total_samples=training.randomColumn('random')
var training_samples=Total_samples.filter(ee.Filter.lessThan('random',0.75))
print(training_samples,"Training Samples")
var validation_samples=Total_samples.filter(ee.Filter.greaterThanOrEquals('random',0.75))
print(validation_samples,"Validation_Samples")

// var classifier = ee.Classifier.smileRandomForest(numberOfTrees, variablesPerSplit, minLeafPopulation, bagFraction, maxNodes, seed)
var classifier=ee.Classifier.smileRandomForest(20).train({
features:training_samples,
classProperty:'landcover',
inputProperties:Bands_selection
})
var classified=sentinel_2A.select(Bands_selection).classify(classifier);

var palette = [
  'blue', //water(0)
  'green', //forest(1)
  'black',//buildings(2)
  '90ee90'//wetland(3)
   
    ];
Map.addLayer(classified,{min: 0, max: 3,palette: palette},"classification");

var Validation_classifier=ee.Classifier.smileRandomForest(30).train({
features:validation_samples,
classProperty:'landcover',
inputProperties:Bands_selection
})

var confusionMatrix=ee.ConfusionMatrix(validation_samples.classify(Validation_classifier)
                    .errorMatrix({
                      actual:'landcover',
                      predicted:'classification'
                    }))
print(confusionMatrix,"confusionMatrix")

print('Kappa Accuracy:', confusionMatrix.kappa());
print(confusionMatrix.accuracy(),"overall_Accuracy")

//-------------Estimation of Area------------------/
var names = ['vegetation','settlements','water area','barelands']
var count = classified.eq([1,2,3,4])
var total = count.multiply(ee.Image.pixelArea()).divide(1e6).rename(names);
var area = total.reduceRegion({
reducer:ee.Reducer.sum(),
  geometry:studyArea,
  scale:10,
maxPixels: 1e12,
bestEffort:true
});
print ('Area in (km²):', area)


var exportimage = function(img,studyarea,desccription){
  
  var exportParams = {
  image: img,
  description: desccription,
  scale: 10,  // Adjust the scale according to the Sentinel-1 resolution
  crs: 'EPSG:4326',
  region: studyarea
  };
  Export.image.toDrive(exportParams);

}

exportimage(classified,studyArea,"2015classified")




