/**
 * Created by Raheli on 16/07/2015.
 *
 * Data: an array of objects. each object contains:
 *    id: the id of the object - number
 *    data: an array of objects. each object contains:
 *      color: the color - string
 *      shape: the shape - string
 *      xCoordinate: x degree coordinate of the entity's position
 *      yCoordinate: y degree coordinate of the entity's position
 *      hovered: if currently hovered - boolean
 *      selected: if currently selected - boolean
 * Events:
 *  on-click - wired when an entity clicked
 *  on-mouse-over - wired when an entity hovered
 * Functions:
 *  updateData - update the data and redraw the entities
 *  updateHoveredView - update the view when data's hovered changed
 */

class CesiumMap {
  constructor($http) {
    'ngInject';

    let directive = {
      controller: CesiumMapController,
      scope: {
        onClick: '&',
        onHover: '&',
      },
      controllerAs: "cesiumMapCtrl",
      bindToController: true,
      link: function (scope, element, attr, ctrl) {

        function hasConfig() {
          return (ctrl.researchService.config.hasOwnProperty("cesium") &&
          ctrl.researchService.config.cesium.hasOwnProperty("url") &&
          ctrl.researchService.config.cesium.url != "");
        }

        Cesium.BingMapsApi.defaultKey = 'AroazdWsTmTcIx4ZE3SIicDXX00yEp9vuRZyn6pagjyjgS-VdRBfBNAVkvrucbqr';
        if (hasConfig() && ctrl.researchService.config.cesium.key != undefined)
          Cesium.BingMapsApi.defaultKey = ctrl.researchService.config.cesium.key;

        let viewerDefs = {
          baseLayerPicker: false,
          fullscreenButton: false,
          navigationHelpButton: false,
          infoBox: false,
          homeButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          animation: false,
          geocoder: false
        };

        // offline images
        if (ctrl.researchService.config.cesium.offline) {
          viewerDefs.imageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: '/assets/NaturalEarthII/{z}/{x}/{reverseY}.jpg',
            credit: '© Analytical Graphics, Inc.',
            tilingScheme: new Cesium.GeographicTilingScheme(),
            maximumLevel: 2
          });
        } else {
          // handle intranet map server and add it into viewerDefs.imageryProvider
          //viewerDefs.imageryProvider = false;
        }

        // create the cesium
        ctrl.cesium = new Cesium.Viewer(element[0], viewerDefs);
        //window.cesium = ctrl.cesium;
        //ctrl.cesium.scene.screenSpaceCameraController.minimumZoomDistance = 235.09295868082492;
        ctrl.cesium.scene.screenSpaceCameraController.maximumZoomDistance = 20000000;

        // handle google map server
        if (hasConfig()) {

          $http.get(ctrl.researchService.config.cesium.url + '/' + ctrl.researchService.config.cesium.path)
            .then(function (response) {
              layers = response.data.geeServerDefs.layers;
              _.forEach(layers, function (layer) {
                geip = new Cesium.GoogleEarthImageryProvider({
                  url: layer.url,
                  path: layer.path,
                  channel: layer.id,
                  tileDiscardPolicy: new Cesium.NeverTileDiscardPolicy()
                });
                geip._requestType = layer.requestType;
                ctrl.cesium.imageryLayers.addImageryProvider(geip);
              });
            });
        }

        // set the zoom level for focus on a location in dbl-click event
        ctrl.focusZoomLevel = (ctrl.researchService.config.hasOwnProperty("cesium") &&
        ctrl.researchService.config.cesium.hasOwnProperty("focusZoomLevel"))? ctrl.researchService.config.cesium.focusZoomLevel: 1900000;

        /**
         * select entity
         * @param movement
         */
        function selectEntity(movement) {

          function updateChildren(edge) {
            if (edge.class == "Edge" && edge.hasOwnProperty("children")) {
              _.forEach(edge.children, function (child) {
                child.selected = edge.selected;
              });
            }
          }

          let pickedObjects = ctrl.cesium.scene.pick(movement.position);

          if (Cesium.defined(pickedObjects)) {
            let entity = pickedObjects.id;
            let node = _.find(ctrl.researchService.research.filteredNodesByLocations, {id: entity.id});
            let edge = _.find(ctrl.researchService.research.filteredEdgesByLocations, {id: pickedObjects.id});
            let selectedID = (node !== undefined) ? node.id : edge.id;

            let dataArray = _.union(ctrl.researchService.research.filteredNodesByLocations, ctrl.researchService.research.filteredEdgesByLocations);

            //update the selected data
            let dataArraySelected = _.filter(dataArray, {selected: true});
            if (event.ctrlKey) {
              _.forEach(dataArray, function (node) {
                if (node.id === selectedID && node.selected)
                  node.selected = false;
                else
                  node.selected = selectedID == node.id ? true : node.selected;
                updateChildren(node);
              });
            }
            else {
              _.forEach(dataArray, function (node) {
                if (node.id === selectedID && node.selected && dataArraySelected.length == 1)
                  node.selected = false;
                else {
                  node.selected = ( node.id === selectedID);
                }
                updateChildren(node);
              });
            }

            //let entity;
            let selectionMode = _.find(dataArray, {selected: true}) != undefined;

            //update the entities by the data
            _.forEach(dataArray, function (item) {
              entity = item.entity;//ctrl.cesium.entities.getOrCreateEntity(item.id);
              if (entity && entity.type == "node") {
                entity.billboard.image = ctrl.mapService.getSVG(item.color, item.shape, selectionMode, item.selected, false, item.favorite);
                entity.selected = item.selected;
                if(entity.polygon)
                  entity.polygon.material = ctrl.getEdgeColor(selectionMode, item.color, item.selected);
              }
              else {
                ctrl.updateEdge(item, selectionMode);
              }
            });

            ctrl.onClick({on: selectionMode});
          }
        }

        function focus(selectedID) {

          if (_.isObject(selectedID)){
            selectedID = selectedID.id;
          }

          let entity = ctrl.cesium.entities.getById(selectedID);

          if (entity == undefined) return;

          let currCameraHeight = ctrl.cesium.camera.positionCartographic.height >= 1000 ? ctrl.cesium.camera.positionCartographic.height * 0.7
              : ctrl.cesium.camera.positionCartographic.height;

          ctrl.cesium.flyTo(entity, {
            duration: 0.5,
            offset : new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(0.0),
              Cesium.Math.toRadians(-90.0),
              currCameraHeight)
          });
        }

        /**
         * focus on entity
         * @param movement
         */
        function focusOnEntity(movement) {

          let entity, pickedObjects = ctrl.cesium.scene.pick(movement.position);

          if (Cesium.defined(pickedObjects)) {
            entity = pickedObjects.id;
            focus(entity.id);
          }
        }

        /**
         * handler for mouse move - mouse over and mouse out
         */
        function mouseOverAndMouseOutEntity(movement) {

          let pickedObject = ctrl.cesium.scene.pick(movement.endPosition);
          if (!Cesium.defined(pickedObject) && ctrl.overedID == "") return;

          let entity, selectionNode, selectionEdge, selectionMode = ctrl.researchService.research.selectionMode;

          if (Cesium.defined(pickedObject) && ctrl.overedID == "") {
            //-----------------
            //mouse over - node
            //-----------------
            if (pickedObject.id instanceof Cesium.Entity) {
              document.body.style.cursor = 'pointer';
              entity = pickedObject.id;
              ctrl.overedID = entity.id;
              entity.item.hovered = true;

              selectionNode = _.find(ctrl.researchService.research.filteredNodesByLocations, {id: entity.id});
              entity.billboard.image = ctrl.mapService.getSVG(entity.item.color, entity.item.shape, selectionMode, selectionNode.selected, true, entity.item.favorite);
              if (entity.polygon) {
                entity.polyline.material = ctrl.setEdgeColor(entity, selectionMode, entity.item.color, entity.item.selected, true, entity.item.favorite);
              }
              ctrl.onHover({item: selectionNode, on: selectionNode.hovered = true});
            }
            //-----------------
            //mouse over - edge
            //-----------------
            else if (pickedObject.primitive.material && ctrl.overedID == "") {
              document.body.style.cursor = 'pointer';
              ctrl.overedID = pickedObject.id;

              selectionEdge = _.find(ctrl.researchService.research.filteredEdgesByLocations, {id: ctrl.overedID});
              selectionEdge.hovered = true;
              ctrl.updateEdge(selectionEdge, selectionMode);
              ctrl.onHover({item: selectionEdge, on: selectionEdge.hovered = true});
            }
            //-----------------
            //mouse out - node
            //-----------------
          } else if (!(Cesium.defined(pickedObject))) {
            entity = ctrl.cesium.entities.getById(ctrl.overedID);
            if (entity && entity.type == "node") {
              document.body.style.cursor = 'default';
              ctrl.overedID = "";
              entity.item.hovered = false;

              selectionNode = _.find(ctrl.researchService.research.filteredNodesByLocations, {id: entity.id});
              entity.billboard.image = ctrl.mapService.getSVG(entity.item.color, entity.item.shape, selectionMode, selectionNode.selected, false, entity.item.favorite);
              if (entity.polygon)
                entity.polyline.material = ctrl.setEdgeColor(entity, selectionMode, entity.item.color, entity.item.selected, false, entity.item.favorite);
              ctrl.onHover({item: selectionNode, on: selectionNode.hovered = false});
            }
            //-----------------
            //mouse out - edge
            //-----------------
            else{
              document.body.style.cursor = 'default';
              selectionEdge = _.find(ctrl.researchService.research.filteredEdgesByLocations, {id: ctrl.overedID});
              ctrl.overedID = "";
              selectionEdge.hovered = false;
              ctrl.updateEdge(selectionEdge, selectionMode);
              ctrl.onHover({item: selectionEdge, on: selectionEdge.hovered = false});
            }
          }
        }

        /**
         * handler for click - select
         */
        ctrl.handler = new Cesium.ScreenSpaceEventHandler(ctrl.cesium.scene.canvas);
        ctrl.handler.setInputAction(selectEntity, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        /**
         * handler for click with control key - select
         */
        ctrl.handler.setInputAction(selectEntity, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.CTRL);

        /**
         * handler for double click - focus
         */
        ctrl.handler.setInputAction(focusOnEntity, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        /**
         * handler for mouse move - mouse over and mouse out
         */
        ctrl.handler.setInputAction(mouseOverAndMouseOutEntity, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // //zoom
        // ctrl.handler.setInputAction(function (wheelZoomAmount) {
        //   var currCameraHeight = ctrl.cesium.camera.positionCartographic.height;
        //   var currentBigThan50000 = currCameraHeight > 50000;
        //
        //   if(currentBigThan50000 !== ctrl.bigThan50000)
        //     ctrl.updateData();
        //   ctrl.bigThan50000 = currentBigThan50000;
        // },  Cesium.ScreenSpaceEventType.WHEEL);

        /**
         * Add or update the entities accordingly to select and hover
         */
        ctrl.addOrUpdateEntities = function () {

          function addPolygone( entity, node){

            let polygonArrCoordinates, color;

            if(node.coordinates && !_.isString( node.coordinates)) {
              polygonArrCoordinates = [];
              _.forEach(node.coordinates, function (coordinate) {
                polygonArrCoordinates = _.concat(polygonArrCoordinates, coordinate);
                polygonArrCoordinates.push(0);
              });

              color = (selectionMode && !node.selected) ? Cesium.Color.DARKGRAY.withAlpha(0.4) : Cesium.Color.fromCssColorString(node.color).withAlpha(0.4);

              entity.polygon = {
                hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(polygonArrCoordinates),
                outline: true,
                fill: true,
                followSurface: true,
                material: color
              };

              entity.polyline = {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights(polygonArrCoordinates),
                width: 4.0,
                followSurface: true,
                material: color
              };
            }
          }

         /* if( ctrl.researchService.locationsNodesEdgesSum > ctrl.researchService.config.maxSizeCards.cesium ){
            ctrl.mapService.limited = true;
            return;
          }
          else{
            ctrl.mapService.limited = false;
          }*/

          let polylines, currCameraHeight, polyline, entity,
            selectionMode = this.researchService.research.selectionMode;

          ctrl.cesium.entities.suspendEvents();

          currCameraHeight = ctrl.cesium.camera.positionCartographic.height;

          /*-----------
           add edges
           -----------*/
          _.forEach(ctrl.researchService.research.filteredEdgesByLocations, function (edge) {
            polyline = ctrl.polylines.add({
              id: edge.id,
              positions : Cesium.PolylinePipeline.generateCartesianArc({
                positions : Cesium.Cartesian3.fromDegreesArrayHeights([edge.source.xCoordinate, edge.source.yCoordinate, 0,
                  edge.target.xCoordinate, edge.target.yCoordinate, 0])
              }),
              width: ctrl.getEdgeWidth( edge.weight, edge.favorite),
              show : true,
              material: ctrl.getEdgeMaterial( selectionMode, edge.color, edge.selected, false, edge.favorite)
            });

            edge.polyline = polyline;
          });

          /*-----------
           add nodes
           -----------*/
          _.forEach(ctrl.researchService.research.filteredNodesByLocations, function (node) {

            ctrl.bigThan50000 = currCameraHeight > 50000;

            node.entity = ctrl.cesium.entities.add({
              id: node.id,
              type: 'node',
              item: node,
              position: Cesium.Cartesian3.fromDegrees(node.xCoordinate, node.yCoordinate, 0.1),
              billboard: {
                image: ctrl.mapService.getSVG(node.color, node.shape, selectionMode, node.selected, node.hovered, node.favorite),
              }
            });

            //add polygones if there
            addPolygone( node.entity, node);
          });

          ctrl.researchService.loading = false;

          ctrl.cesium.entities.resumeEvents();
        }

        ctrl.getEdgeMaterial = function( selectionMode, edgeColor, edgeSelected, edgeHover, edgeFavorite){

          let mateial = {}, color;


          if(edgeHover){
            color = Cesium.Color.BLACK;
          }
          else{
            if( (selectionMode && edgeSelected) || (!selectionMode && !edgeSelected)){
              color = Cesium.Color.fromCssColorString( edgeColor)
            }
            else{
              color = Cesium.Color.DARKGRAY.withAlpha(0.4);
            }
          }

          if(edgeFavorite){

            return new Cesium.Material({
              fabric : {
                type : 'PolylineOutline',
                uniforms : {
                  color : color,
                  outlineColor: Cesium.Color.YELLOW.withAlpha(0.2),
                  outlineWidth: 3
                }
              }
            });
          }
          else{
            return new Cesium.Material({
              fabric : {
                type : 'PolylineOutline',
                uniforms : {
                  color : color,
                  outlineColor: color,
                  outlineWidth: 3
                }
              }
            });
          }
        }

        ctrl.updateEdge = function( item, selectionMode){
          let cartographicX, cartographicY, carX, carY;

          item.polyline.material =
            ctrl.getEdgeMaterial(selectionMode, item.color, item.selected, item.hovered, item.favorite);
          item.polyline.width = ctrl.getEdgeWidth(item.weight, item.favorite);
        }

        ctrl.getEdgeWidth = function( weight, favorite){
          let favoriteWeight = favorite? 3 : 0;

          return (weight < 4 ? 4 : weight) + favoriteWeight;
        }

        ctrl.getHeightForCurrentZoom = function(){

          let currCameraHeight = ctrl.cesium.camera.positionCartographic.height;
          let height = ctrl.bigThan50000? currCameraHeight / 500: currCameraHeight / 1000;

          return height;
        }

        ctrl.addEdgeHoverEntity = function ( edge, selectionMode){

          function addEntity(params, collection) {

            var entity = collection.getOrCreateEntity(params.id);
            entity.show = true;
            var keys = Object.keys(params);
            keys.forEach(function (value) {
              if (value != 'id')
                entity[value] = params[value];
            });

            return entity;
          }

          var zIndex = 2;

          let params = {
            id: 'hoverEdge_' + edge.id,
            type: 'edge',
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([edge.source.xCoordinate, edge.source.yCoordinate, zIndex,
                edge.target.xCoordinate, edge.target.yCoordinate, zIndex]),
              width: edge.weight < 4 ? 4 : edge.weight,
              followSurface: true,
              material: Cesium.Color.BLACK
            }
          };

          addEntity( params, ctrl.cesium.entities);
          params = undefined;
        }

        ctrl.removeEdgeHoverEntity = function (edge) {
          let entity = ctrl.cesium.entities.getById( 'hoverEdge_' + edge.id);
          if(entity)
            entity.show = false;
        }

        ctrl.getEdgeColor = function (selectionMode, edgeColor, edgeSelected) {

          if (!selectionMode || selectionMode && edgeSelected) {
            return Cesium.Color.fromCssColorString(edgeColor);
          }
          else if (selectionMode && !edgeSelected){
            return Cesium.Color.DARKGRAY.withAlpha(0.4);
          }
        }

        ctrl.setEdgeColor = function (entity, selectionMode, edgeColor, edgeSelected, edgeHover, edgeFavorite){//selectionMode, edgeColor, edgeSelected) {

          if (edgeHover) {
            if(edgeFavorite){
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight) + 8;
              return ctrl.getMaterial( 'black');
            }
            else {
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight);
              return Cesium.Color.BLACK.withAlpha(1);
            }
          }

          if (!selectionMode || selectionMode && edgeSelected) {
            if(edgeFavorite){
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight) + 8;
              return ctrl.getMaterial( edgeColor);
            }
            else {
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight);
              return Cesium.Color.fromCssColorString( edgeColor);
            }
          }
          else if (selectionMode && !edgeSelected){
            if(edgeFavorite){
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight) + 8;
              return ctrl.getMaterial( 'gray');
            }
            else {
              if(entity)
              entity.polyline.width = ctrl.getEdgeWidth( entity.weight);
              return Cesium.Color.DARKGRAY.withAlpha(0.4);
            }
          }
        }

        ctrl.getMaterial = function(color){
          return new Cesium.StripeMaterialProperty({
            evenColor : Cesium.Color.YELLOW.withAlpha(0.1),
            oddColor : Cesium.Color.fromCssColorString( color),
            orientation: Cesium.StripeOrientation.HORIZONTAL,
            repeat :3.0
          });
        }

        ctrl.updateHoveredView = function updateHoveredView( hoveredArr, on) {

          let entity, edge, selectionMode = ctrl.researchService.research.selectionMode, height;

          _.forEach(hoveredArr, function (item) {

            if(item.polyline){
              item.hovered = on;
              if( item.hovered){
                ctrl.addEdgeHoverEntity(item, selectionMode);
              }else{
                ctrl.removeEdgeHoverEntity(item);
              }
            }
            else if(item.parent && item.parent.polyline){
              item.parent.hovered = on;
              if( item.parent.hovered){
                ctrl.addEdgeHoverEntity(item.parent, selectionMode);
              }else{
                ctrl.removeEdgeHoverEntity(item.parent);
              }
            }
            else {

              entity = item.entity;//ctrl.cesium.entities.getById(item.id);

              if (item.class == "Node") {//node
                if (entity != undefined) {

                  entity.item.hovered = on;
                  entity.billboard.image = ctrl.mapService.getSVG(item.color, item.shape, selectionMode, item.selected, on, item.favorite);

                  let currCameraHeight = ctrl.cesium.camera.positionCartographic.height;

                  let coordinates = Cesium.Cartographic.fromCartesian(entity.position.getValue());

                  height = item.hovered? 0.3: (item.selected? 0.2: 0.1);
                  if (on)
                    entity.position = Cesium.Cartesian3.fromRadians(coordinates.longitude, coordinates.latitude, height);
                  else
                    entity.position = Cesium.Cartesian3.fromRadians(coordinates.longitude, coordinates.latitude, height);

                  if (entity.polygon) {
                    let color = (!on && selectionMode && !item.selected) ? Cesium.Color.DARKGRAY.withAlpha(0.4) : Cesium.Color.fromCssColorString(item.color).withAlpha(0.4);
                    entity.polygon.material = color;
                    entity.polyline.material = ctrl.setEdgeColor(entity, selectionMode, item.color, item.selected, on, item.favorite);
                  }
                }
              }
            }
          });
        }

        ctrl.updateSelectedView = function () {

          //if( ctrl.mapService.limited ) return;
          let entity, height;
          let selectionMode = ctrl.researchService.research.selectionMode;

          _.forEach(ctrl.researchService.research.filteredNodesByLocations, function (item) {
            entity = item.entity;//ctrl.cesium.entities.getOrCreateEntity(item.id);

            entity.billboard.image = ctrl.mapService.getSVG(item.color, item.shape, selectionMode, item.selected, false, item.favorite);
            let coordinates = Cesium.Cartographic.fromCartesian(entity.position.getValue());

            height = item.selected? 0.2: 0.1;
            if (item.selected)
              entity.position = Cesium.Cartesian3.fromRadians(coordinates.longitude, coordinates.latitude, height);
            else
              entity.position = Cesium.Cartesian3.fromRadians(coordinates.longitude, coordinates.latitude, height);

            if(entity.polygon) {
              let color = (selectionMode && !item.selected) ? Cesium.Color.DARKGRAY.withAlpha(0.4) : Cesium.Color.fromCssColorString(item.color).withAlpha(0.4);
              entity.polygon.material = color;
              entity.polyline.material = color;
            }
          });

          _.forEach(ctrl.researchService.research.filteredEdgesByLocations, function (item) {

            item.hovered = false;
            ctrl.updateEdge(item, selectionMode);
          });
        }

        /**
         * click on the button - show/hide links
         */
        ctrl.switchEdges = function (showEdges) {

          if(! ctrl.polylines) return;
          /**
           * get list of edges and show/hide them
           * @param entitiesList
           * @param show
           */
          function showListEdges(edgesList, show) {
            _.forEach(edgesList, function (edge) {
              edge.show = show;
            });
          }

          var edges = ctrl.polylines._polylines;

          if (showEdges) {
            showListEdges(edges, true);//show
          }
          else {
            showListEdges(edges, false);//hide
          }
        };

        ctrl.fitHomeBounds = function () {
          if (angular.isUndefined(ctrl.researchService.research.modulesStates[1].homeBounds)) {
            return;
          }
          ctrl.cesium.scene.camera.flyTo(
            {
              destination: boundsToRect(ctrl.researchService.research.modulesStates[1].homeBounds),
              duration: 1.25
            }
          );
        }

        ctrl.setBounds = function () {
          ctrl.switchZoom();
        };

        function boundsToRect(bounds) {
          return Cesium.Rectangle.fromDegrees(bounds[0][1], bounds[1][0], bounds[1][1], bounds[0][0]);
        }

        ctrl.getBounds = function () {
          ctrl.cesium.scene.mode = Cesium.SceneMode.SCENE2D;
          var c2 = new Cesium.Cartesian2(0, 0);
          var leftTop = ctrl.cesium.scene.camera.pickEllipsoid(c2, ctrl.cesium.scene.globe.ellipsoid);

          c2 = new Cesium.Cartesian2(ctrl.cesium.scene.canvas.width, ctrl.cesium.scene.canvas.height, 0);
          var rightDown = ctrl.cesium.scene.camera.pickEllipsoid(c2, ctrl.cesium.scene.globe.ellipsoid);

          ctrl.cesium.scene.mode = Cesium.SceneMode.SCENE3D;
          if (leftTop != undefined && rightDown != undefined) {
            leftTop = Cesium.Cartographic.fromCartesian(leftTop);
            rightDown = Cesium.Cartographic.fromCartesian(rightDown);
          } else {
            return undefined;
          }

          return [[Cesium.Math.toDegrees(leftTop.latitude), Cesium.Math.toDegrees(leftTop.longitude)],
            [Cesium.Math.toDegrees(rightDown.latitude), Cesium.Math.toDegrees(rightDown.longitude)]];
        };

        ctrl.switchZoom = function () {
          if (angular.isUndefined(ctrl.researchService.research.modulesStates[1].bounds)) {
            return;
          }
          //home bound are undefined
          if (angular.isUndefined(ctrl.researchService.research.modulesStates[1].homeBounds)) {
            ctrl.researchService.research.modulesStates[1].homeBounds = ctrl.researchService.research.modulesStates[1].bounds;
          }

          ctrl.cesium.scene.camera.setView({
            destination: boundsToRect(ctrl.researchService.research.modulesStates[1].bounds)
            });
        };

        ctrl.updateData = function () {
          //ctrl.cesium.entities.removeAll();
          ctrl.destroyNodesAndEdges();
          ctrl.addOrUpdateEntities();
        }

        ctrl.destroyNodesAndEdges = function(){

          _.forEach(ctrl.researchService.research.filteredEdgesByLocations, function (edge) {
            delete edge.polyline;// = undefined;
          });

          _.forEach(ctrl.researchService.research.filteredNodesByLocations, function (node) {
            delete node.entity;// = undefined;
          });

          ctrl.polylines.removeAll();
          ctrl.cesium.entities.removeAll();
        }

        ctrl.updateFavorites = function () {
          ctrl.updateData();
        }

        scope.$on('$destroy', function () {
          ctrl.mapService.setDestroy();
          ctrl.handler.destroy();
          //ctrl.cesium.screenSpaceEventHandler.destroy();
          ctrl.destroyNodesAndEdges();
          ctrl.cesium.destroy();
          ctrl.cesium = null;
          ctrl.onClick = null;
          ctrl.onHover = null;
          ctrl.mapService.mapInstances[ctrl.mapService.constants.MAP_3D] = null; //clean
          ctrl.mapService = null;
          ctrl = null;

          element.off();
          dealoc(element);
          function dealoc(obj) {
            var jqCache = angular.element.cache;
            if (obj) {
              if (angular.isElement(obj)) {
                cleanup(angular.element(obj));
              }
              else if (!window.jQuery) {
                // jQuery 2.x doesn't expose the cache storage.
                for (var key in jqCache) {
                  var value = jqCache[key];
                  if (value.data && value.data.$scope == obj) {
                    delete jqCache[key];
                  }
                }
              }
            }

            function cleanup(element)
            {
              element.off().removeData();
              if (window.jQuery)
              {
                // jQuery 2.x doesn't expose the cache storage; ensure all element data
                // is removed during its cleanup.
                jQuery.cleanData([element]);
              }
              // Note: We aren't using element.contents() here. Under jQuery,   element.contents() can fail
              // for IFRAME elements. jQuery explicitly uses (element.contentDocument ||
              // element.contentWindow.document) and both properties are null for IFRAMES that aren't attached
              // to a document.
              var children = element[0].childNodes || [];
              for (var i = 0; i < children.length; i++)
              {
                cleanup(angular.element(children[i]));
              }
            }
          }


        });

        //--------------
        //call functions
        //--------------
        ctrl.setBounds();

        ctrl.focusOnEntity = focus;

        ctrl.polylines = ctrl.cesium.scene.primitives.add(new Cesium.PolylineCollection());

        ctrl.addOrUpdateEntities();

        ctrl.switchEdges(ctrl.researchService.research.showEdges);

        ctrl.researchService.loading = false;

        ctrl.researchService.saveJsonDataToLocalStorage();
      }
    };

    return directive;
  }
}

class CesiumMapController {

  constructor($compile, $q, mapService, researchService) {
    'ngInject';

    var that = this;

    this.compileService = $compile;
    this.researchService = researchService;
    this.mapService = mapService;
    this.mapService.mapInstances[this.mapService.constants.MAP_3D] = this;
    this.overedID = "";
    this.zoomed = false;

    //this.mapService.limitNumber = this.researchService.config.maxSizeCards.cesium;
    this.mapService.setDestroy(function () {

      function afterFlyTo() {
        that.researchService.research.modulesStates[1].bounds = that.getBounds();

        deferred.resolve();
      }

      if (!that.mapService.transition){
        return 1;
      }
      let position, deferred = $q.defer();

      if (Math.cos(that.cesium.camera.pitch) < 0.001){
        position = that.cesium.camera.position;
      }
      else{
        try {
          let rect = that.cesium.canvas.getBoundingClientRect();

          let center = new Cesium.Cartesian2(rect.width / 2, rect.height / 2);
          position = that.cesium.camera.pickEllipsoid(center, that.cesium.scene.globe.ellipsoid);

          let cartographic = Cesium.Cartographic.fromCartesian(position);
          cartographic.height = that.cesium.camera.positionCartographic.height;

          position = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
        }
        catch(err){
          position = that.cesium.camera.position;
        }
      }

      let flyToObj = {
        destination: position,
        easingFunction: Cesium.EasingFunction.LINEAR_NONE,
        orientation: {
          heading: Cesium.Math.toRadians(0.0), //go north
          pitch: Cesium.Math.toRadians(-90.0), //look down
          roll: 0.0 //no change
        },
        duration: 0.6,
        complete: afterFlyTo
      }
      angular.element(that.cesium.scene.canvas).css({'opacity': '0', 'transition': 'opacity 1s ease'});

      that.cesium.scene.camera.flyTo(flyToObj);

      return deferred.promise;
    })
  }
}

export default CesiumMap;

