import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { ToastController } from '@ionic/angular';
import { LanguageService } from './language.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FeatureInfoService } from './feature-info.service';

declare var M: any;
declare var ol: any;
declare var cordova: any;


@Injectable({
  providedIn: 'root'
})
export class MapService {

  editableLayers: any[] = [];
  move: any = null;
  private mapProfileApplication: any;
  mapProj = 'EPSG:3857';
  centerMapTransformed: number[] = [] 

  constructor(private toastController: ToastController, private languageService: LanguageService, private featureInfoService: FeatureInfoService) { 
    M.config('SQL_WASM_URL', '/assets/external/api-cnig/');
  }
  //downloadZoom, downloadExtent y selectedProj vendrán con algún valor cuando el método se utilice al iniciar
  //el mapa entrando desde download
  async initMap(container: string, profile: any, downloadZoom: number = 9, downloadExtent: number[] = [], selectedProj: string ) {
    this.editableLayers = [];
    this.mapProfileApplication = profile.application;
    M.proxy(false);

    const mapa = new M.map({
      container,
      projection: 'EPSG:3857*m',
      layers: ['OSM'],
    });
    if (profile) {
      await this.applyMapDataFromProfile(mapa, profile.application, downloadZoom, downloadExtent, selectedProj);
      await this.applyMapBackgroundsAndLayers(mapa, profile);
      this.createInformationPlugin(mapa);
    }
    return mapa;
  }

  async initMapOffline(container: string, zoom: number, extent: number[], selectedProj: string, bgLayer: any, databaseLayers: any[]) {
    this.editableLayers = [];
    M.proxy(false);

    const fileName = bgLayer.path;
    const fileInfo = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Data,
    });

    const localUrl = fileInfo.uri; 
    const folderPath = localUrl.replace(`/${fileName}`, '').replace('file://', '');

    try {
      const baseUrl = await this.startLocalServer(folderPath);
      const fileUrl = baseUrl + fileName;

      const mbtile = new M.layer.MBTiles({
        name: bgLayer.title,
        legend: bgLayer.title,
        url: fileUrl,
        isBase: true
      });

      let center = [(extent[0] + extent[2])/2, (extent[1] + extent[3])/2];
      center = ol.proj.transform(center, selectedProj, this.mapProj);
      this.centerMapTransformed = center;
      const bboxMin = ol.proj.transform([extent[0], extent[1]], selectedProj, this.mapProj);
      const bboxMax = ol.proj.transform([extent[2], extent[3]], selectedProj, this.mapProj);
      const bbox = bboxMin.concat(bboxMax);
      

      const mapa = new M.map({
        container,
        projection: 'EPSG:3857*m',
        center: { x: center[0], y: center[1] },
        bbox,
        zoom,
        layers: [mbtile], //capa base offline
      });

      databaseLayers.forEach((l: any) => {
         const layer = new M.layer.GeoJSON({
          name: l.name,
          legend: l.name,
          source: JSON.parse(l.geojson),
         });
         layer.idLayer = l.id_layer; 
         this.editableLayers.push(layer);
      });
      /*
      cordova.plugins.CorHttpd.stopServer(() => {
        console.log('Servidor detenido');
      });
      */
      const groupOpts = {
        name: "Capas descargadas",
        legend: "Capas descargadas",
        layers: this.editableLayers
      };
      mapa.addLayers(new M.layer.LayerGroup(groupOpts));
      return mapa;
    } catch (error) {
      console.error('No se pudo iniciar el mapa', error);
    }    
  }

  private async startLocalServer(localFolder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cordova.plugins.CorHttpd.getURL((url: string) => {
        if (url && url.length > 0) {
          console.log('Servidor ya en ejecución en:', url);
          resolve(url + '/');
        } else {
          cordova.plugins.CorHttpd.startServer({
            www_root: localFolder, 
            port: 8080,
            localhost_only: true,
          }, (url: string) => {
            if (url && url.startsWith('http')) {
              console.log('Servidor HTTP iniciado en:', url);
              resolve(url + '/');
            } else {
              reject('Error al iniciar el servidor HTTP');
            }
          });
        }
      });
    });
  }

  private createInformationPlugin(mapa: any) {
    const infoPlugin = new M.plugin.Information({
      position: 'TL',
      format: 'text/html'
    });
    mapa.addPlugin(infoPlugin);
    setTimeout(() => {
      this.featureInfoService.init(infoPlugin);
    }, 500);    
  }

  deactivateFeatureInfo() {
    this.featureInfoService.deactivate();
  }

  activateFeatureInfo() {
    this.featureInfoService.activate();
  }

  addClickFunctionToEditableLayers(clickFn: Function) {
    this.editableLayers.forEach(l => {
      l.on(M.evt.LOAD, (features: any[]) => {
        if (Array.isArray(features)) { //si la capa no tiene features, el objeto obtenido en el evento no es array
          features.forEach((f:any) => f.setAttribute('vendor.mapea.click', clickFn));
        }
      });
    });
  }

  private async applyMapDataFromProfile(mapa: any, application: any, zoom: number, downloadExtent: number[], selectedProj: string) {
    let srs = '';
    let center = [];
    let bbox = [];
    //origen descraga mapa se define extent    
    if (downloadExtent && downloadExtent.length === 4) {
      bbox = downloadExtent;
      center = [(bbox[0] + bbox[2])/2, (bbox[1] + bbox[3])/2];
      //si se selecciona tipo de proyección, hay que transformar las coordenadas
      if (selectedProj !== '' && selectedProj !== srs) {
        center = ol.proj.transform(center, selectedProj, this.mapProj);
        const bboxMin = ol.proj.transform([bbox[0], bbox[1]], selectedProj, this.mapProj);
        const bboxMax = ol.proj.transform([bbox[2], bbox[3]], selectedProj, this.mapProj);
        bbox = bboxMin.concat(bboxMax);
      }    
    }else{
      srs = application.srs;
      center = [application.pointOfInterest.x, application.pointOfInterest.y];
      bbox = application.initialExtent;
    //let zoom = application.defaultZoomLevel;
      center = ol.proj.transform(center, srs, this.mapProj);
      const bboxMin = ol.proj.transform([bbox[0], bbox[1]], srs, this.mapProj);
      const bboxMax = ol.proj.transform([bbox[2], bbox[3]], srs, this.mapProj);
      bbox = bboxMin.concat(bboxMax);
    }
    console.log(`Estableciendo bbox: ${bbox}`);
    mapa.setBbox(bbox);
    console.log(`Estableciendo zoom: ${zoom}`);
    mapa.setZoom(zoom);
    console.log(`Estableciendo centro: ${center}`);
    mapa.setCenter(center);
    this.centerMapTransformed = center;
  }

  private async applyMapBackgroundsAndLayers(mapa: any, profile: any) {
    //this.applyMapBackgrounds(mapa, profile);
    this.applyMapLayers(mapa, profile);
  }

  private applyMapBackgrounds(mapa: any, profile: any) {
    const backgrounds: any[] = profile.backgrounds;
    const groups: any[] = profile.groups;
    const layers: any[] = profile.layers;
    const services: any[] = profile.services;
    const mapBg: any[] = [];
    for(let b of backgrounds) {
      let group = groups.find(g => g.id === b.id);
      let bg = this.createMapBackground(group, layers, services);
      mapBg.push(bg);
    }
    this.createBackgroundPlugin(mapa, mapBg);
  }

  private applyMapLayers(mapa: any, profile: any) {
    const trees: any[] = profile.trees;
    const layers: any[] = profile.layers;
    const services: any[] = profile.services;
    const tasks: any[] = profile.tasks;
    const groupLayers: any[] = [];
    trees.forEach((t: any) => {
      const gLayers: any[] = [];
      const groupOpts = {
        name: t.title,
        legend: t.title,
        layers: gLayers
      };
      const rootNode: string = t.rootNode;
      const treeNodes = t.nodes;
      if (rootNode.includes('/tree/')) { //root "falso"
        const children = treeNodes[rootNode].children;
        children.forEach((c: string) => {
          const node = treeNodes[c];
          let MLayer = this.processCartographyNode(node, treeNodes, layers, services, tasks);          
          groupOpts.layers.push(MLayer);
        });
      } else {
        const node = treeNodes[rootNode];
        let MLayer = this.processCartographyNode(node, treeNodes, layers, services, tasks);
        groupOpts.layers.push(MLayer);
      }
      groupLayers.push(new M.layer.LayerGroup(groupOpts));
    });
    mapa.addLayers(groupLayers);
    //this.createTOCPlugin(mapa);
  }

  private createMapBackground(group: any, layers: any[], services: any[]) {
    const bg: any = {};
    bg.title = group.title;
    bg.id = group.id.split('/')[1];
    const bgLayers = this.createBackgroundLayers(group, layers, services);
    bg.layers = bgLayers;
    return bg;
  }

  getBaseLayer(profile: any, idGroup: string, title: string) {
    const group = profile.groups.find((g: any) => g.id = idGroup);
    const bgLayers = this.createBackgroundLayers(group, profile.layers, profile.services);
    const groupOpts = {
      name: title,
      legend: title,
      layers: bgLayers,
      isBase: true,
    };
    return new M.layer.LayerGroup(groupOpts);
  }

  private createBackgroundLayers(group: any, layers: any[], services: any[]) {
    const bgLayers = [];
    const filteredLayers = layers.filter(l => group.layers.includes(l.id));
    for(let l of filteredLayers) {
      let serviceData = services.find(s => s.id === l.service);
      const bgLayer = this.createLayer(serviceData, l, true);
      bgLayers.push(bgLayer);
    }
    return bgLayers;
  }

  private processCartographyNode(node: any, treeNodes: any, layers: any[], services: any[], tasks: any[]) {
    const layerId = node.resource;
    const taskId = node.action;
    let result;
    if (layerId || taskId) { // Nodo hoja
      const layer = layers.find(l => l.id === layerId);
      let service = null;
      if (layer) {
        service = services.find(s => s.id === layer.service);
      }
      const task = tasks.find(t => t.id === taskId);
      const groupLayers = [];
      if (layer && service) {
        groupLayers.push(this.createLayer(service, layer));
      }
      if (task) {
        groupLayers.push(this.createLayerByTask(task));
      }
      const groupOpts = {
        name: node.title,
        legend: node.title,
        layers: groupLayers
      };
      result = new M.layer.LayerGroup(groupOpts);
    } else { // Nodo carpeta
      const groupLayers: any[] = [];
      const groupOpts = {
        name: node.title,
        legend: node.title,
        layers: groupLayers
      };
      const children = node.children;
      children.forEach((c: string) => {
        const node = treeNodes[c];
        let MLayer = this.processCartographyNode(node, treeNodes, layers, services, tasks);
        groupOpts.layers.push(MLayer);
      });
      result = new M.layer.LayerGroup(groupOpts);
    }
    return result;
  }

  createLayer(service: any, layer: any, base: boolean = false) {
    let layerOptions = {
      url: service.url,
      name: layer.layers[0],
      legend: layer.title,
      isBase: base,
      displayInLayerSwitcher: !base,
      visible: true
    };
    const result = this.buildLayerByType(service.type, layerOptions, service.parameters);
    result.idLayer = layer.id;
    console.log(`Creado layer: ${layerOptions}`);
    return result;
  }

  createLayerByTask(task: any) {
    let layerOptions = {
      url: task.url,
      name: task.parameters.typename.value,
      isBase: false,
      displayInLayerSwitcher: true,
      visible: true
    };
    const result = this.buildLayerByType('WFS', layerOptions);
    result.idLayer = task.id;
    console.log(`Creado layer: ${layerOptions}`);
    return result;
  }

  private buildLayerByType(type: string, options: any, extraOptions: any = {}) {
    let layer = null;
    switch (type) {
      case 'WMS':
        layer = new M.layer.WMS(options);
        break;
      case 'WMTS':
        options.matrixSet = extraOptions.matrixSet;
        layer = new M.layer.WMTS(options, {format: extraOptions.format});
        break;
      case 'WFS':
        layer = new M.layer.WFS(options);
        this.editableLayers.push(layer);
        break;
      default:
        break;
    }
    return layer;
  }

  createFeaturesGeojson(geojson: any, geomProj: string, mapProj: string) {
    const format = new M.format.GeoJSON();
    const features = format.read(geojson, mapProj);
    //feature.getImpl().getOLFeature().getGeometry().transform(geomProj, mapProj);
    return features;
  }

  private createBackgroundPlugin(mapa: any, layerOpts: any[]) {
    const bgPlugin = new M.plugin.BackImgLayer({
      collapsed: true,
      collapsible: true,
      columnsNumber: 3,
      empty: false,
      position: 'TL',
      layerOpts
    });
    mapa.addPlugin(bgPlugin);
  }

  private createTOCPlugin(mapa: any) {
    const tocPlugin = new M.plugin.Layerswitcher({
      collapsed: true,
      collapsible: true,
      isDraggable: false,
      position: 'TR',
      modeSelectLayers: 'eyes',
      tools: [],
      isMoveLayers: false,
      https: true,
      http: true,
      showCatalog: false,
      useProxy: false,
      displayLabel: false,
      addLayers: false,
      statusLayers: true,
      order: 1,
      useAttributions: true,
    });
    mapa.addPlugin(tocPlugin);
  }

  async getLocation() {
    let position = null;
    try {
      const permission = await Geolocation.requestPermissions();
      if(permission.location === 'granted') {
        position = await Geolocation.getCurrentPosition();
        position= {
          x: position.coords.longitude,
          y: position.coords.latitude
        };
        console.log('Ubicacion: ', position);
      } else {        
        console.log('No se tienen permisos para obtener la ubicación, obteniendo de la configuración del mapa');
        await this.errorLocationToast("permissionError");
        position = this.getDefaultLocation();
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      if ((error as Error).message?.toLowerCase().includes('location services')) {
        await this.errorLocationToast("locationError");
      }else{
        await this.errorLocationToast("error");
      }   

      position = this.getDefaultLocation();
    }
    return position;
  }

  private async errorLocationToast(typeError: string) {
    if (typeError === 'permissionError') {
      this.languageService.translateTag('map.locationPermissionError').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
    } else if (typeError === 'locationError') {
      this.languageService.translateTag('map.locationDisabled').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
    }else{
      this.languageService.translateTag('map.locationError').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
    }
  }

  async createToast(msg: string, type: string, pos: "top" | "bottom" | "middle" | undefined) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 3000,
      color: type,
      position: pos
    });
    await toast.present();
  }
  

  getDefaultLocation() {
    let position = {
      x: 4,
      y: 40
    }
    if (this.centerMapTransformed && this.mapProj) {
      const coords = this.transformCoords(this.centerMapTransformed, this.mapProj, 'EPSG:4326');
      position = {
        x: coords[0],
        y: coords[1]
      };
    }
    return position;
  }

  transformCoords(coords: number[], projOrig: string, projDest: string) {
    const result = ol.proj.transform(coords, projOrig, projDest);
    return result;
  }

  addMoveInteraction(mapa: any, olFeatures: any[], callback: Function) {
    const olMap = mapa.getMapImpl();
    const collection = new ol.Collection(olFeatures);
    this.move = new ol.interaction.Translate({
      features: collection
    });
    this.move.on('translateend', (evt: any) => {
      callback();
    });
    olMap.addInteraction(this.move);
  }

  removeMoveInteraction(mapa:any) {
    if (this.move) {
      mapa.getMapImpl().removeInteraction(this.move);
      this.move = null;
    }
  }
}
