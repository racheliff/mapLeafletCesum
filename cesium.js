fetch('./config.json')
  .then((httpRes) => httpRes.json())
  .then(({ baseLayers }) => {
    const options = {};
    const { current } = baseLayers;
    switch (current) {
      case 'bing':
        const { key } = baseLayers.bing;
        Cesium.BingMapsApi.defaultKey = key;
        break;
      case 'wms':
        const { wms } = baseLayers;
        options.imageryProvider = new Cesium.WebMapServiceImageryProvider(wms);
        break;
      case 'naturalEarth':
        const { naturalEarth } = baseLayers;
        options.imageryProvider = new Cesium.UrlTemplateImageryProvider(naturalEarth);
        break;
    }

    const viewer = new Cesium.Viewer('cesiumContainer', options);
  });
