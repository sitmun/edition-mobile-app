import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { LanguageService } from 'src/app/services/language.service';
import { Router, ActivatedRoute, NavigationExtras } from '@angular/router';
import { AuthorizationService } from 'src/app/services/authorization.service';
import { WfsService } from 'src/app/services/wfs.service';
import { TreeNode, TreeviewService } from 'src/app/services/treeview.service';
import { NetworkService } from 'src/app/services/network.service';
import { DatabaseService } from 'src/app/services/database.service';
import { LoadingController, ToastController } from '@ionic/angular';
import { ProxyService } from 'src/app/services/proxy.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { InstancesService } from 'src/app/services/instances.service';
import { MapService } from 'src/app/services/map.service';
import { Device } from '@capacitor/device';
import { ProfileModalComponent } from 'src/app/components/profile-modal/profile-modal.component';

declare var ol: any;

@Component({
  selector: 'app-download',
  templateUrl: './download.page.html',
  styleUrls: ['./download.page.scss'],
})
export class DownloadPage implements OnInit {

  messages_: any = {};
  networkConnected = true;
  extent = {
    minX: '',
    minY: '',  
    maxX: '',     
    maxY: ''
  };
  zoomValue = 7;
  app: any = {};
  ter: any = {};
  layersTreeData: TreeNode[] = [];
  bgTreeData: TreeNode[] = [];
  profile: any = {};
  layersSizeBytes: number = 0;
  layersSizeMBytes: number = 0;
  freeSpaceMB: number = 0;
  estimatedSize: number = 0;
  mapProj: string[] = ['EPSG:3857', 'EPSG:4326', 'EPSG:25831', 'EPSG:25830'];
  mapProjSelected: string = '';
  mapProjSelectedPrev: string = '';
  mapPage: boolean = false;
  openToast = false;
  alertModalOpen = false;
  deleteModalOpen = false;
  downloadProgress = { type: '', value: 0 };
  @ViewChild('profileModal') profileModal!: ProfileModalComponent; 

  constructor(private languageService: LanguageService, private location: Location, private wfsService: WfsService,
    private router: Router, private route: ActivatedRoute, private authorizationService: AuthorizationService,
    private treeviewService: TreeviewService, private networkService: NetworkService, private databaseService: DatabaseService,
    private loadingCtrl: LoadingController, private proxyService: ProxyService, private cdr: ChangeDetectorRef,
    private toastController: ToastController, private instancesService: InstancesService, private mapService: MapService) {
    
    this.route.queryParams.subscribe(params => {
        const navigation = this.router.getCurrentNavigation();
        if (navigation) {
          const tempState = navigation.extras.state;
          if (tempState){
            if (tempState['app']) {
              this.app = tempState['app'];
            }
            if (tempState['ter']) {
              this.ter = tempState['ter'];
            }
            if (tempState['zoom']) {
              this.zoomValue = tempState['zoom'];
            }
            if (tempState['bbox']) {
              this.extent.minX = tempState['bbox'].x.min;
              this.extent.minY = tempState['bbox'].y.min;
              this.extent.maxX = tempState['bbox'].x.max;
              this.extent.maxY = tempState['bbox'].y.max;
            }
            if (tempState['map']) {
              this.mapPage = tempState['map'];
            }
          }
        }
    });
  }

  ngOnInit() {
    this.initPage(); 
  }

  private async initPage(){
    this.instancesService.setAppTerritory(this.app.id, this.ter.id);
    this.profile = await this.authorizationService.getProfile(this.app.id, this.ter.id);
    this.layersTreeData = this.treeviewService.createLayersTreeData(this.profile);
    this.bgTreeData = this.treeviewService.createBackgroundsTreeData(this.profile);
    await this.getData();
  }

  async ionViewWillEnter() {
    this.updateNetworkStatus(await this.networkService.getStatus());
    this.networkService.addListener(this.updateNetworkStatus.bind(this));
    if (this.mapPage) {
        this.getCoords(this.mapService.mapProj, this.mapProjSelected); //convertir coordenadas desde mapa
    }
  }

  async openDownloadModal() {
    const permission = await Filesystem.requestPermissions();
    if(permission.publicStorage != 'granted') {
      console.log('No se tienen permisos para almacenar en el storage');
      await this.errorStorageToast();
    }else{
      const bgMapServices = this.getmapServices();
      if (bgMapServices.length === 0) {
        this.languageService.translateTag('download.noBgLayerSelected').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
        return;
      }      
      const checkedLayers = this.treeviewService.getCheckedLayers(this.layersTreeData);
      if (checkedLayers.length === 0) {
        this.languageService.translateTag('download.noLayerSelected').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
        return;
      }
      let extent = '';
      if (this.extent.minX && this.extent.minY && this.extent.maxX && this.extent.maxY) {
        extent = `${this.extent.minX},${this.extent.minY},${this.extent.maxX},${this.extent.maxY}`;
      }
      //estimar tamaño de descarga
      const layers = [];
      for (const cl of checkedLayers) { //capas seleccionadas
        if (cl.action) {
          const task = this.profile.tasks.find((t: any) => t.id === cl.action);
          const layerName = task.parameters.typename.value;
          const resp = await this.wfsService.getFeatures(task.url, layerName, extent, this.mapProjSelected);
          const layer = {
            id: this.app.id,
            territory: this.ter.id,
            id_layer: task.id,
            layer_name: layerName,
            fields: cl.fields,
            geojson: resp.data,
            extent: extent,
            zoom: this.zoomValue,
            proj: this.mapProjSelected
          }
          layers.push(layer);
        }
      }
      const encoder = new TextEncoder();
      const encoded = encoder.encode(JSON.stringify(layers));
      this.estimatedSize = Math.round(encoded.length / (1024 * 1024) * 10) / 10;  //peso capas

      const resp = await this.proxyService.getbgLayerFileWeight(
        bgMapServices, this.extent, this.zoomValue, this.mapProjSelected);
      this.estimatedSize += Math.round(resp.data.estimatedMbtilesSizeMb * 10) / 10;

      //comprobar espacio disponible
      const info = await Device.getInfo();
      if (info.realDiskFree) {
        this.freeSpaceMB = Math.round(info.realDiskFree/ (1024 * 1024) * 10) / 10;  //espacio libre en MB
        console.log('Espacio libre en disco:', this.freeSpaceMB);
      }else{
        console.log('No se pudo obtener información del disco');
      }
      this.alertModalOpen = true; //abre modal de descarga
    }    
  }

  closeDownloadModal(){
    this.alertModalOpen = false;
  }

  openDeleteModal() {
    this.deleteModalOpen = true;
  }

  closeDeleteModal(){
    this.deleteModalOpen = false;
  }

  async downloadLayers() {
    this.alertModalOpen = false;
    this.instancesService.setAppTerritory(this.app.id, this.ter.id);
    const bgMapServices = this.getmapServices();
    const createResp = await this.proxyService.sendbgLayerServices(
      bgMapServices, this.extent, this.zoomValue, this.mapProjSelected);
    const jobHandle = createResp.data?.jobHandle ?? createResp.data;
    this.downloadProgress.type = 'download.progress-request';
    this.downloadProgress.value = 0.01;
    if (jobHandle) {
      await new Promise<void>((resolve) => {
        const checkStatus = async () => {
          const resp = await this.proxyService.checkbgServices(jobHandle);
          if (resp.data.processedTiles) {
            this.downloadProgress.value = resp.data.processedTiles / resp.data.totalTiles;
          }
          if (resp.data.status === 'COMPLETED') {
            this.downloadProgress.value = 1;
            await this.storagebgLayer(jobHandle);
            resolve();
          } else {
            setTimeout(checkStatus, 3000);
          }
        };
        checkStatus();
      });
    }

    //almacena en base de datos
    const base64 = await this.convertImageToBase64(this.app.logo);
    await this.databaseService.insertApp(this.app.id, this.app.title, base64);
    await this.databaseService.insertTerritory(this.ter.id, this.app.id, this.ter.name);
  
    await this.databaseService.deleteLayersByAppAndTer(this.app.id, this.ter.id); //eliminar capas previas
    let extent = '';
    if (this.extent.minX && this.extent.minY && this.extent.maxX && this.extent.maxY) {
      extent = `${this.extent.minX},${this.extent.minY},${this.extent.maxX},${this.extent.maxY}`;
    }
    const checkedLayers = this.treeviewService.getCheckedLayers(this.layersTreeData);
    for (const cl of checkedLayers) {
      if (cl.action) {
        await this.loadFeaturesByTask(cl.action, cl.fields, extent, this.mapProjSelected, this.zoomValue);
      }
    }    
      
    await this.getDatabaseWeight();
    this.downloadProgress.value = 0; // reinicia progreso
    this.openToast = true; // descarga completada
  }


  async removeDownload() {
    const id = this.app.id + '_' + this.ter.id; 
    const fileName = `bgMapa_${id}.mbtiles`;
    //borra fichero previo si existe
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Data,
      });
    } catch (err) {
        console.log(`Archivo no existe, no es necesario eliminarlo: ${err}`);
    }
    await this.databaseService.deleteTer(this.ter.id);
    await this.databaseService.deleteLayersByAppAndTer(this.app.id, this.ter.id);
    await this.databaseService.deleteApp(this.app.id);
    await this.getData();
    this.closeDeleteModal();
  }

  async loadFeaturesByLayer(layerId: string, fields: any, extent: string, mapProj: string, zoom: number) {
    const layer = this.profile.layers.find((l: any) => l.id === layerId);
    const service = this.profile.services.find((s: any) => s.id === layer.service);
    const resp = await this.wfsService.getFeatures(service.url, layer.layers[0], extent, mapProj);
    console.log(resp.data);
    await this.databaseService.insertLayer(this.app.id, this.ter.id, layerId, layer.title, JSON.stringify(fields), JSON.stringify(resp.data), extent, zoom, mapProj);
  }

  async loadFeaturesByTask(taskId: string, fields: any, extent: string, mapProj: string, zoom: number) {
    const task = this.profile.tasks.find((t: any) => t.id === taskId);
    const valueName = task.parameters.typename.value;    
    const resp = await this.wfsService.getFeatures(task.url, valueName, extent, mapProj);
    console.log(resp.data);
    
    let layer: any = null;
    for (const root of this.layersTreeData) {
      layer = findLayerByAction(root, taskId);
      if (layer) break; 
    }
   function findLayerByAction(layer: any, id: string): any | null {
      if (layer.action && layer.action === id) {
        return layer;
      }      
      for (const child of layer.children) {
        const layer = findLayerByAction(child, id);
        if (layer) {
          return layer;
        }
      }
      return null;
    }

    await this.databaseService.insertLayer(this.app.id, this.ter.id, taskId, layer.name, JSON.stringify(fields), JSON.stringify(resp.data), extent, zoom, mapProj);
  }

  private async errorStorageToast() {
    this.languageService.translateTag('download.storagePermissionError').subscribe((text: string) => this.createToast(text, 'warning', 'bottom'));
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

  private async getData(){
    //obtener capas descargadas
    const layers = await this.databaseService.getLayersByAppAndTer(this.app.id, this.ter.id);
    const layerLoadIds: string[] = []; 
    this.layersSizeBytes = 0;
    this.layersSizeMBytes = 0;  
    
    if (layers[0]) {
      layers.forEach(l => {
        layerLoadIds.push(l.id_layer);
      });    
      this.treeviewService.setCheckedLayers(this.layersTreeData, layerLoadIds); //check capas recursivo
      
      await this.getDatabaseWeight(); //peso capas
      this.zoomValue = layers[0].zoom;
      this.mapProjSelected = layers[0].proj;
      this.mapProjSelectedPrev = layers[0].proj;
      if (layers[0].extension !== '') {
        const coords = layers[0].extension.split(",");
        this.extent.minX = coords[0];
        this.extent.minY = coords[1];
        this.extent.maxX = coords[2];
        this.extent.maxY = coords[3];
      }
    } else {
      this.treeviewService.setCheckedLayers(this.layersTreeData, layerLoadIds); //check capas recursivo
      this.mapProjSelected = this.profile.application.srs;
      this.mapProjSelectedPrev = this.profile.application.srs;
      this.zoomValue = this.profile.application.defaultZoomLevel;
      this.extent.minX = this.profile.application.initialExtent[0];
      this.extent.minY = this.profile.application.initialExtent[1];
      this.extent.maxX = this.profile.application.initialExtent[2];
      this.extent.maxY = this.profile.application.initialExtent[3];
    }
  }

  private async getDatabaseWeight() {
    const layers = await this.databaseService.getLayersByAppAndTer(this.app.id, this.ter.id);
    const json = JSON.stringify(layers);
    const blob = new Blob([json], { type: 'application/json' });
    this.layersSizeBytes = blob.size;

    const id = this.app.id + '_' + this.ter.id; 
    const fileName = `bgMapa_${id}.mbtiles`;

    try {
      const info = await Filesystem.stat({
        path: fileName,
        directory: Directory.Data
      });
      this.layersSizeBytes += info.size; 
      const bgMapSizeMB = Math.round(info.size / (1024 * 1024) * 10) / 10;
      console.log(`Archivo MBTiles encontrado, tamaño: ${bgMapSizeMB} MB`);
    } catch (error) {
      console.log(`Archivo no existe, no es necesario calcular su peso: ${error}`);
    }
    this.layersSizeMBytes = Math.round(this.layersSizeBytes / (1024 * 1024) * 10) / 10;
    console.log(`Tamaño total: ${this.layersSizeMBytes} MB`);
  }

  private async storagebgLayer(jobHandle: string) {
    this.downloadProgress.type = 'download.progress-file';
    this.downloadProgress.value = 0.01;
    const id = this.app.id + '_' + this.ter.id;
    const fileName = `bgMapa_${id}.mbtiles`;
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Data,
      });
    } catch (err) {
      console.log(`Archivo no existe, no es necesario eliminarlo: ${err}`);
    }

    await this.proxyService.downloadMbtilesFile(jobHandle, fileName);
    this.downloadProgress.value = 1;
    this.cdr.detectChanges();

    const bg = this.bgTreeData.find((bg: TreeNode) => bg.checked);
    if (bg) {
      await this.databaseService.insertbgLayer(this.app.id, this.ter.id, bg.name, fileName);
    }
  }

  private getmapServices(): { serviceId: number; layerIds: number[] }[] {
    const byService = new Map<number, Set<number>>();
    const bg = this.bgTreeData.find((node: TreeNode) => node.checked);
    if (!bg) {
      return [];
    }
    const groupLayer = this.profile.groups.find((group: any) => group.id === bg.resource);
    const bgLayers = this.profile.layers.filter((layer: any) => groupLayer.layers.includes(layer.id));
    for (const layer of bgLayers) {
      const serviceId = layer.service;
      if (!byService.has(serviceId)) {
        byService.set(serviceId, new Set<number>());
      }
      byService.get(serviceId)!.add(layer.id);
    }
    return Array.from(byService.entries()).map(([serviceId, layerIds]) => ({
      serviceId,
      layerIds: Array.from(layerIds)
    }));
  }

  backPage() {
    this.location.back();
  }

  updateNetworkStatus(connected: boolean) {
    this.networkConnected = connected;
  }

  onZoomChange(event: any) {
    console.log(event.detail.value);
    this.zoomValue = event.detail.value;
  }

  toggleExpand(node: TreeNode) {
    this.treeviewService.toggleExpand(node);
  }

  toggleCheck(node: TreeNode) {
    this.treeviewService.toggleCheck(node);
  }

  toggleBgCheck(node: TreeNode, event: any) {
    const checked = node.checked;
    if (checked) {
      this.bgTreeData.forEach(tn => this.treeviewService.toggleCheck(tn));
      if (event) {
        const inputs = document.querySelectorAll<HTMLInputElement>('.bg-check');
        inputs.forEach(i => i.checked = false);
        event.target.checked = checked;
      }
      node.checked = checked;
    }
  }


  openMap() {
    const checkedLayers = this.treeviewService.getCheckedLayers(this.layersTreeData);

    const navigationExtras: NavigationExtras = {
      state: {
        app: this.app,
        ter: this.ter,
        zoom: this.zoomValue,
        layers: checkedLayers,
        download: true,
        extent: this.extent,
        mapProject: this.mapProjSelected
      }
    };
    this.navigate('map', navigationExtras);
  }

  navigate(path: string, navigationExtras: NavigationExtras) {
    this.router.navigate([path], navigationExtras);
  }

  onProjChange(){
    if (Object.values(this.extent).every(valor => valor !== '')) {
     this.getCoords(this.mapProjSelectedPrev, this.mapProjSelected);
    }
    this.mapProjSelectedPrev = this.mapProjSelected;
  }

  private getCoords(projOrig: string, projDest: string){
    const coordsTransformed = this.transformCoords([parseFloat(this.extent.minX), parseFloat(this.extent.minY)],
    [parseFloat(this.extent.maxX), parseFloat(this.extent.maxY)], projOrig, projDest);
    this.extent.minX = coordsTransformed.x.min.toString();
    this.extent.maxX = coordsTransformed.x.max.toString();
    this.extent.minY = coordsTransformed.y.min.toString();
    this.extent.maxY = coordsTransformed.y.max.toString();
  }

  private transformCoords(coordsMin: number[], coordsMax: number[], projOrig: string, projDest: string) {
    const resultMin = ol.proj.transform(coordsMin, projOrig, projDest);
    const resultMax = ol.proj.transform(coordsMax, projOrig, projDest);
    const result = {
      x: {
        min: resultMin[0],
        max: resultMax[0]
      },
      y: {
        min: resultMin[1],
        max: resultMax[1]
      }
    };
    return result;
  }

  closeToast() {
    this.openToast = false;
  }

  private convertImageToBase64(url: string): Promise<string> {
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('No se pudo obtener la imagen');
      }
      return response.blob();
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string); 
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(blob);
    }));
  }

  openMenu() {
    this.profileModal.openProfileModal();
  }

  async showLoading() {
    const loading = await this.loadingCtrl.create({});
    loading.present();
  }

  hideLoading() {
    this.loadingCtrl.dismiss();
  }

}
