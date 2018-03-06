function initmap() {
  map = new L.Map('leafletContainer');
  map.setView(new L.LatLng(51.3, 0.7), 9);

  fetch('./config.json')
    .then((httpRes) => httpRes.json())
    .then(({baseLayers}) => {
      let layer;
      switch (baseLayers.current) {
        case 'bing': {
          const {key} = baseLayers.bing;
          layer = L.tileLayer.bing(key);
          break;
        }
        case 'wms': {
          const {url, layers} = baseLayers.wms;
          layer = new L.tileLayer.wms(url, {layers});
          break;
        }
        case 'naturalEarth': {
          let {url, maximumLevel} = baseLayers.naturalEarth;
          url = url.replace('reverseY', '-y');
          layer = new L.TileLayer(url, {maxZoom: maximumLevel});
          break;
        }
      }
      map.addLayer(layer);
    });
}

initmap();