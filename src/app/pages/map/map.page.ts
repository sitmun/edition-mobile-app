import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { LanguageService } from 'src/app/services/language.service';
import { MapService } from 'src/app/services/map.service';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { AuthorizationService } from 'src/app/services/authorization.service';
import { TreeNode, TreeviewService } from 'src/app/services/treeview.service';
import { NetworkService } from 'src/app/services/network.service';
import { WfsService } from 'src/app/services/wfs.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatabaseService } from 'src/app/services/database.service';
import { ProfileModalComponent } from 'src/app/components/profile-modal/profile-modal.component';

declare var M: any;
declare var ol: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
})
export class MapPage implements OnInit {

  networkConnected = true;
  mapa: any;
  app: any = {};
  ter: any = {};
  isFeatureModalOpen = false;
  isTocModalOpen = false;
  isBgModalOpen = false;
  isSaveModalOpen = false;
  layerEdit: any = null;
  activeEdition = false;
  geomEdition = false;
  newGeometry: any = null;
  unsavedChanges = false;
  attrData: any[] = [];
  featureAttr: Record<string, any> = {};
  featureAttrForm: FormGroup;
  feature: any = null;
  newPoint = false;
  layersTreeData: TreeNode[] = [];
  bgTreeData: TreeNode[] = [];
  featureEditions: Record<string, { inserts: any[]; deletes: any[]; updates: any[] }> = {};
  saveErrors: string[] = [];
  imageValue: string | null = null;
  errorImg: string[] = [];
  imageAttr: string = '';
  cameraBtnDisabled: boolean = true;
  downloadMap: boolean = false;
  offlineMap: boolean = false;
  zoom: number = 9;
  downloadLayers: any[] = [];
  extent: number[] = [];
  mapProjSelected: string = '';
  currentEditionTask: any = null; 
  @ViewChild('profileModal') profileModal!: ProfileModalComponent; 

  constructor(private mapService: MapService, private languageService: LanguageService, private _location: Location,
    private router: Router, private route: ActivatedRoute, private authorizationService: AuthorizationService,
    private treeviewService: TreeviewService, private networkService: NetworkService, private cdr: ChangeDetectorRef,
    private wfsService: WfsService, private formBuilder: FormBuilder, private databaseService: DatabaseService) {
    this.route.queryParams.subscribe(params => {
        const navigation = this.router.getCurrentNavigation();
        if (navigation) {
          const tempState = navigation.extras.state;
          if (tempState && tempState['app']) {
            this.app = tempState['app'];
          }
          if (tempState && tempState['ter']) {
            this.ter = tempState['ter'];
          }
          if (tempState && tempState['zoom']) {
            this.zoom = tempState['zoom'];
          }
          if (tempState && tempState['download']) {
            this.downloadMap = tempState['download'];
          }
          if (tempState && tempState['layers']) {
            this.downloadLayers = tempState['layers'];
          }
          if (tempState && tempState['extent']) {
            Object.values(tempState['extent']).forEach(value => {
              if (value !== '' && !isNaN(Number(value))) {
                this.extent.push(Number(value));
              }
            });
          }
          if (tempState && tempState['mapProject']) {
            this.mapProjSelected = tempState['mapProject'];
          }
        }
    });
    this.featureAttrForm = this.formBuilder.group({});
  }

  ngOnInit() {
    this.initPage();
  }

  private async initPage(){
    this.updateNetworkStatus(await this.networkService.getStatus());
    this.networkService.addListener(this.updateNetworkStatus.bind(this));
    //datos mapa con conexión
    if (this.networkConnected) {
      const profile = await this.authorizationService.getProfile(this.app.id, this.ter.id);
      if (this.downloadMap) {
        profile.trees = this.filterProfileTrees(profile.trees, this.downloadLayers); 
      }
      await this.createMap(profile); 
    }else{
      //datos mapa sin conexión
      await this.createMapOffline();
    }
    //carga tabla ediciones 
    const featureEditions = await this.databaseService.getEditionsByAppAndTer(this.app.id, this.ter.id);
    featureEditions.map(edition => {
      this.featureEditions[edition.id_layer] = JSON.parse(edition.editionjson);
    }); 

    const layers = await this.mapa.getImpl().getAllLayerInGroup();
    for (const layer of layers) {
      try {
        if (this.offlineMap) {
          this.loadChanges(layer);
        }else{
          layer.on(M.evt.LOAD, (features: any) => { //espera a que la capa sea cargada
            this.loadChanges(layer);
          });
        }
      }  catch (error) {
        console.error(`Error procesando la capa con ID ${layer.idLayer}:`, error);
      }
    }
  }
  
  private filterProfileTrees(trees: any[], layers: any[]): any[] {
    return trees.filter(tree => {
      const nodes = tree.nodes;
      const validNodes = new Set<string>();

      //nodos seleccionados
      Object.entries(nodes).forEach(([id, node]: [string, any]) => {
        if ((node.resource || node.action) && layers.find(l => l.resource === node.resource || l.action === node.action)) {
          validNodes.add(id);
        }
      });

      // incluir padres de nodos seleccionados
      let add = true;
      while (add) {
        add = false;
        Object.entries(nodes).forEach(([id, node]: [string, any]) => {
          if (!validNodes.has(id) && node.children?.some((childId: string) => validNodes.has(childId))) {
            validNodes.add(id);
            add = true;
          }
        });
      }

      // Limpiar los children de los nodos, dejando solo los válidos
      validNodes.forEach((id) => {
        const node = nodes[id];
        if (node?.children) {
          node.children = node.children.filter((childId: string) => validNodes.has(childId));
        }
      });


      // eliminar nodos no válidos
      for (const id in nodes) {
        if (!validNodes.has(id)) {
          delete nodes[id];
        } 
      }

      // quedarse solo con los arboles con algún nodo filtrado
      return Object.keys(nodes).length > 0;
    });
  }

  private async createMap(profile: any) {
    this.mapa = await this.mapService.initMap('map', profile, this.zoom, this.extent, this.mapProjSelected);
    this.mapService.addClickFunctionToEditableLayers(this.featureClickHandler.bind(this));
    this.layersTreeData = this.treeviewService.createLayersTreeData(profile);
    this.bgTreeData = this.treeviewService.createBackgroundsTreeData(profile);
    const bgNode = this.bgTreeData.find(n => n.checked);
    if (bgNode) {
      this.toggleBgCheck(bgNode, null);
    }    
  }

  private async createMapOffline(){
    const layers = await this.databaseService.getLayersByAppAndTer(this.app.id, this.ter.id);
    const bgLayer = await this.databaseService.getbgLayerByAppAndTer(this.app.id, this.ter.id);
    if (layers.length === 0) {
      console.warn("No hay capas guardadas para este territorio.");
    }else{
      this.offlineMap = true;
      let zoom = layers[0].zoom;        
      let extent = layers[0].extension.split(',').map(Number);
      let proj = layers[0].proj;
      this.mapa = await this.mapService.initMapOffline('map', zoom, extent, proj, bgLayer[0], layers);
      this.mapService.addClickFunctionToEditableLayers(this.featureClickHandler.bind(this));
      this.layersTreeData = this.treeviewService.createLayersTreeDataOffline(layers);
    } 
    
  }


  private loadChanges(layer: any){
    // comprueba si se registraron ediciones en la bbdd
    if (this.featureEditions[layer.idLayer]) {
      console.log(`Añadiendo ediciones a la capa con ID ${layer.idLayer}`)
      //se añaden los inserts        
      this.featureEditions[layer.idLayer].inserts.forEach((featureInsert, index, arr) => {
        const feature = new M.Feature();
        feature.setId(featureInsert.id);
        feature.setAttributes(featureInsert.attributes);
        feature.setGeometry(featureInsert.geometry);          
        feature.setAttribute('vendor.mapea.click', this.featureClickHandler.bind(this));
        layer.addFeatures([feature]);
        arr[index] = feature;
      });
      //se añaden los updates
      this.featureEditions[layer.idLayer].updates.forEach((featureUpdate, index, arr) => {
        const feature = layer.getFeatureById(featureUpdate.id);
        if (feature) {                
          feature.setAttributes(featureUpdate.attributes);
          feature.setGeometry(featureUpdate.geometry);                      
          arr[index] = feature;    
        }else{
          console.warn(`La modificación realizada en el feature con ID ${featureUpdate.id} no pudo ser cargada. No se encontró su ID`)
          arr.splice(index, 1); //elimina la edición que no ha podido ser asignada, porque sino impide el guardado de la capa. Seguirá en la bbdd                
        }
      });
      //se añaden los deletes
      this.featureEditions[layer.idLayer].deletes.forEach((featureDelete, index, arr) => {
        const feature = layer.getFeatureById(featureDelete.id);
        if (feature){
          layer.removeFeatures([feature]);
          arr[index] = feature;
        }else{
          console.warn(`La modificación realizada en el feature con ID ${featureDelete.id} no pudo ser cargada. No se encontró su ID`)
          arr.splice(index, 1); 
        }
      });
    }
  }

  ionViewWillEnter() {
    this.networkService.addListener(this.updateNetworkStatus.bind(this));
  }

  ionViewWillLeave() {
    if (this.mapa) {
      this.mapa.destroy();
      this.mapa = null;
    }
    this.feature = null;
    this.layerEdit = null;
    this.activeEdition = false;
    this.featureAttr = {};
    this.featureAttrForm.reset();
    this.featureEditions = {};
  }

  backPage() {
    this._location.back();
  }

  updateNetworkStatus(connected: boolean) {
    this.networkConnected = connected;
  }

  openFeatureModal(newPoint: boolean) {
    this.centerMapByFeature(this.feature);
    this.newPoint = newPoint;
    this.isFeatureModalOpen = true;
    //this.mapService.removeMoveInteraction(this.mapa);
    //inicializa campo imagen si algún campo ha sido definido anteriormente como imagen  
    if (this.imageAttr) {
      this.imageValue = this.featureAttrForm.value[this.imageAttr];
      this.enableCameraBtn();
    } else {
      this.disableCameraBtn();
    }
  }

  closeFeatureModal(resetGeom: boolean) {
    this.isFeatureModalOpen = false;
    if (resetGeom) {
      this.newGeometry = null;
    }
  }

  async openTocModal() {    
    this.isTocModalOpen = true;
  }

  closeTocModal() {
    this.isTocModalOpen = false;
  }

  openBgModal() {
    this.isBgModalOpen = true;
  }

  closeBgModal() {
    this.isBgModalOpen = false;
  }

  closeSaveModal() {
    this.isSaveModalOpen = false;
  }

  async createNewFeature() {
    if (this.layerEdit) {
      this.feature = null;
      this.imageAttr = '';
      this.imageValue = null;
      this.featureAttr = {};
      await this.setAttrData();
      this.openFeatureModal(true);
    } else {
      this.languageService.translateTag('map.noEditLayerSelected').subscribe(text => this.mapService.createToast(text, 'warning', 'top'));
    }
  }

  async featureClickHandler(evt: any, feature: any) {
    this.feature = feature;
    this.imageAttr = '';
    this.imageValue = null;
    this.featureAttr = this.feature.getAttributes();
    await this.setAttrData();
    this.openFeatureModal(false);
    this.cdr.detectChanges();
  }

  async setAttrData() {
    const fieldsKeys = Object.keys(this.currentEditionTask.fields);
    const formControls: any = {};
    this.attrData = [];
    const fieldsKeysFiltered = fieldsKeys.filter((f: any) => this.currentEditionTask.fields[f].editable || this.currentEditionTask.fields[f].required);
    for (let fk of fieldsKeysFiltered) {
      const field = this.currentEditionTask.fields[fk];
      const data: Record<string, any> = {
        key: fk,
        label: field.label,
        type: field.type,
        defaultValue: this.featureAttr[fk] || await this.calculateFieldValue(field.value),
        required: field.required,
        editable: field.editable
      };
      if (field.listValues) {
        data['listValues'] = field.listValues;
      }
      if (field.type === 'image') {
        this.imageAttr = fk;
      }
      this.addFeatureFormControl(data, formControls);
      this.attrData.push(data);
    }
    this.featureAttrForm = this.formBuilder.group(formControls);
    this.featureAttrForm.valueChanges.subscribe(values => {
      this.unsavedChanges = true;
    });
  }

  async calculateFieldValue(value: any) {
    const regex = /^\$\{[^}]+\}$/; //${...}
    if (regex.test(value)) {
      const fieldName = value.slice(2, -1);
      switch (fieldName) {
        case 'AUDIT_USER':
          return (await this.databaseService.getLoggedUser())[0].name;
        case 'AUDIT_DATE':
          return new Date().toISOString();
        default:
          return '';
      }
    }
    return value;
  }

  addFeatureFormControl(attrData: any, formControls: any) {
    let value;
    switch (attrData.type) {
      case 'text':
      case 'listbox':
      case 'date':
      case 'image':
        value = attrData.defaultValue || '';
        break;
      case 'number':
        value = attrData.defaultValue || 0;
        break;
    }
    if (attrData.required) {
      formControls[attrData.key] = [value, Validators.required];
    } else {
      formControls[attrData.key] = [value, null];
    }
  }

  enableCameraBtn() {
    this.cameraBtnDisabled = false;
  }

  disableCameraBtn() {
    this.cameraBtnDisabled = true;
  }

  onFeatureDateChange(key: string, event: any) {
    const values: any = {};
    values[key] = event.detail.value;
    this.featureAttrForm?.patchValue(values);
  }

  async onSaveModal() {
    //guardar imagen
    if (this.errorImg.length === 0 && this.imageAttr !== '')  {
      const values: any = {};
      values[this.imageAttr] = this.imageValue;
      this.featureAttrForm?.patchValue(values);
    }
    this.featureAttrForm.markAllAsTouched();
    if (this.featureAttrForm.valid) {
      this.featureAttr = this.featureAttrForm.value;
      if (this.newPoint) {
        const position: any = await this.mapService.getLocation();
        if (position) {
          const coordinates = [position.x, position.y];
          const id = `new${Date.now()}`;
          const geojson = {
            type: 'Feature',
            id,
            geometry: {
              type: 'Point',
              coordinates
            },
            properties: this.featureAttr
          };
          const mapProj = this.mapa.getProjection();
          this.feature = this.mapService.createFeaturesGeojson(geojson, 'EPSG:4326', mapProj)[0];
          this.feature.setId(id);
          this.feature.setAttribute('vendor.mapea.click', this.featureClickHandler.bind(this));
          this.layerEdit.addFeatures([this.feature]);
          this.centerMapByFeature(this.feature);
          this.addFeatureEdition(this.layerEdit.idLayer, 'inserts');
        }
      } else {
        this.feature.setAttributes(this.featureAttr);
        if (this.newGeometry) {
          this.feature.setGeometry(this.newGeometry);
        }
        console.log(`Editando feature con ID: ${this.feature.id}`);   
        this.addFeatureEdition(this.layerEdit.idLayer, 'updates');
      }
      this.newPoint = false;
      this.unsavedChanges = false;
    } else {
      this.languageService.translateTag('map.invalidFeatureForm').subscribe(text => this.mapService.createToast(text, 'danger', 'top'));
    }
  }

  centerMapByFeature(feature: any) {
    if(feature) {
      const center = this.newGeometry ? this.newGeometry.coordinates : feature.getGeometry().coordinates;
      this.mapa.setCenter(center);
      this.mapa.setZoom(17);
    }
  }

  onDeleteModal() {
    console.log(`Eliminando feature con ID: ${this.feature.getId()}`);
    this.layerEdit.removeFeatures([this.feature]);
    this.addFeatureEdition(this.layerEdit.idLayer, 'deletes');
    this.closeFeatureModal(true);
  }

  async addFeatureEdition(layer: string, operation: 'inserts' | 'deletes' | 'updates') {
    if (!this.featureEditions[layer]) {
      this.featureEditions[layer] = { inserts: [], deletes: [], updates: [] };
    }
    //comprobar ediciones anteriores no guardadas
    if (operation === 'updates') {
      let index = this.featureEditions[layer].inserts.findIndex(edition => edition === this.feature); 
      //modificar nuevo elemento creado
      if (index !== -1) {
        this.featureEditions[layer].inserts[index] = this.feature;
      }else{
        //modificar otra vez
        index = this.featureEditions[layer].updates.findIndex(edition => edition === this.feature);
        index !== -1 ? this.featureEditions[layer].updates[index] = this.feature : this.featureEditions[layer].updates.push(this.feature);
      }     
    }else if(operation === 'deletes'){
      let index = this.featureEditions[layer].inserts.findIndex(edition => edition === this.feature); 
      //eliminar un nuevo elemento creado
      if (index !== -1) {
        this.featureEditions[layer].inserts.splice(index, 1);
      }else{
        //eliminar elemento modificado
        index = this.featureEditions[layer].updates.findIndex(edition => edition === this.feature);
        index !== -1 ? this.featureEditions[layer].updates.splice(index, 1) : this.featureEditions[layer].deletes.push(this.feature);
      }      
    }else{
      this.featureEditions[layer].inserts.push(this.feature);
    }    
    console.log(`Edición de feature realizado. Layer: ${layer}`);
    console.log(this.featureEditions[layer]);
    
    //añadir todas las ediciones realizadas a bbdd 
    if (
      this.featureEditions[layer].inserts.length === 0 &&
      this.featureEditions[layer].deletes.length === 0 &&
      this.featureEditions[layer].updates.length === 0
    ) {
      delete this.featureEditions[layer];
      await this.databaseService.deleteEditionsByLayer(this.app.id, this.ter.id, layer);
    }else{
      const simpleEditionFeatures = this.serializeEditions(this.featureEditions[layer]);
      await this.databaseService.insertEdition(this.app.id, this.ter.id, layer, JSON.stringify(simpleEditionFeatures));  
    }
  }

  //algunas propiedades de featureEditions dan problemas para serializar y guardar en la bbdd, necesario simplificar
  private serializeEditions(featureEditions: Record<string, any[]>): Record<string, any[]>{
    const editions: Record<string, any[]> = {};

    for (const [operation, features] of Object.entries(featureEditions)) {
      editions[operation] = features.map(feature => {
        const object: Record<string, any> = {
          id: feature.getId(),
          attributes: feature.getAttributes(),
          geometry: feature.getGeometry()
        };
        return object;
      });
    }
    return editions;
  }

  toggleExpand(node: TreeNode) {
    this.treeviewService.toggleExpand(node);
  }

  toggleVisible(node: TreeNode) {
    node.visible = !node.visible;
    this.treeviewService.toggleVisible(node);
    let layer = null;
    if (node.resource || node.action) { //layer
      layer = this.mapa.getImpl().getAllLayerInGroup().filter((l:any) => [node.resource, node.action].includes(l.idLayer));
    } else { //layerGroup
      layer = this.mapa.getLayerGroup().filter((lg:any) => lg.legend === node.name);
    }
    layer.forEach((l: any) => {
      l.setVisible(node.visible);
    });
  }
  
  toggleCheck(node: TreeNode) {
    if (this.layerEdit){
      this.layerEdit.extract = false; //capa editada anterior
    }
    this.layerEdit = null;
    this.activeEdition = !node.checked;
    if (this.activeEdition) {
      this.layersTreeData.forEach(tn => this.treeviewService.toggleCheck(tn));
      this.currentEditionTask = node.task;
      this.mapService.deactivateFeatureInfo();
      this.mapa.getFeatureHandler().clearSelectedFeatures();
    } else {
      this.mapService.activateFeatureInfo();
    }
    this.layerEdit = this.mapa.getImpl().getAllLayerInGroup().find((l:any) => l.idLayer === node.action);
    this.layerEdit.extract = this.activeEdition;
    node.checked = this.activeEdition;
  }
  
  toggleBgCheck(node: TreeNode, event: any) {
    const checked = node.checked;
    let baseLayer: any = 'OSM'; // Si ninguna capa de fondo seleccionada, se aplicará la por defecto
    if (checked) {
      this.bgTreeData.forEach(tn => this.treeviewService.toggleCheck(tn));
      if (event) {
        const inputs = document.querySelectorAll<HTMLInputElement>('.bg-check');
        inputs.forEach(i => i.checked = false);
        event.target.checked = checked;
      }
      node.checked = checked;
      const profile = this.authorizationService.getProfileData();
      baseLayer = this.mapService.getBaseLayer(profile, node.resource || '', node.name);
    } 
    this.mapa.removeLayers(this.mapa.getBaseLayers());
    this.mapa.addLayers(baseLayer);
  }

  editGeometry() {
    if (this.newPoint) {
      this.languageService.translateTag('map.editGeometryError').subscribe(text => this.mapService.createToast(text, 'warning', 'top'));
    } else {
      //const olFeature = this.feature.getImpl().getOLFeature();
      //this.mapService.addMoveInteraction(this.mapa, [olFeature], this.onMoveEnd.bind(this));
      this.geomEdition = true;
      this.closeFeatureModal(false);
    }
  }

  saveGeom() {
    const center = this.mapa.getCenter();
    const newCoords = [center.x, center.y];
    const featGeometry = this.feature.getGeometry();
    this.newGeometry = {
      type: featGeometry.type,
      coordinates: newCoords
    };
    this.openFeatureModal(false);
    this.geomEdition = false;
    this.unsavedChanges = true;
  }

  cancelGeomEdition() {
    this.openFeatureModal(false);
    this.geomEdition = false;
  }

  onMoveEnd() {
    this.layerEdit.redraw();
    this.addFeatureEdition(this.layerEdit.idLayer, 'updates');
  }

  async saveAllFeatures() {
    this.saveErrors = [];
    const layers = this.mapa.getImpl().getAllLayerInGroup();
    //recorre cada capa y comprueba si se realizaron ediciones
    for (const layer of layers){
      await this.saveFeaturesByLayer(layer);
    }
  }

  async saveFeaturesByLayerId(layerId: string) {
    this.saveErrors = [];
    console.log(`Guardando capa con ID ${layerId}`);
    const layer = this.mapa.getImpl().getAllLayerInGroup().find((l:any) => l.idLayer === layerId);
    await this.saveFeaturesByLayer(layer);
  }

  async saveFeaturesByLayer(layer: any) {
    try {      
      if (this.featureEditions[layer.idLayer]) {
        const result = await this.wfsService.saveFeatures(layer, this.featureEditions[layer.idLayer], this.mapa.getProjection().code);
        if (result === '200') {
          await this.databaseService.deleteEditionsByLayer(this.app.id, this.ter.id, layer.idLayer);
          delete this.featureEditions[layer.idLayer];
        } else {
          this.saveErrors.push(result);
          this.isSaveModalOpen = true;
        }
      }
    } catch (error) {
      console.error(`Error procesando la capa con ID ${layer.idLayer}:`, error);
    }
  }


  saveMap() {
    const navigationExtras: NavigationExtras = {
      state: {
        app: this.app,
        ter: this.ter,
        zoom: this.mapa.getZoom(),
        bbox: this.mapa.getBbox(),
        map: true
      }
    };
    this.navigate('download', navigationExtras);
  }

  navigate(path: string, navigationExtras: NavigationExtras) {
    this.router.navigate([path], navigationExtras);
  }

  async selectImg() {
    this.errorImg = [];
    const permission = await this.requestCameraPermission();
    if (permission){
      this.takePhoto();
    }
  }

  removeImg(){
    this.imageValue = null;
  }

  private async requestCameraPermission() {
    try {
      const permissionStatus = await Camera.requestPermissions();
      console.log('Camera permission status:', permissionStatus);
      
      if (permissionStatus.camera === 'granted') {
        return true;
      } else {
        // Permiso denegado o restringido
        console.log('Permiso de cámara no concedido');
        this.errorImg.push('imagePermissionError');
        return false;
      }
    } catch (error) {
      console.error('Error solicitando permisos de cámara', error);
      this.errorImg.push('imagePermissionError');
      return false;
    }
  }

  private takePhoto() {
    const prompt = {
      header: '',
      gallery: '',
      picture: ''
    };

    forkJoin({
      header: this.languageService.translateTag('map.prompt.header'),
      gallery: this.languageService.translateTag('map.prompt.gallery'),
      picture: this.languageService.translateTag('map.prompt.picture')
    }).subscribe(({header, gallery, picture}) => {
      prompt.header = header;
      prompt.gallery = gallery;
      prompt.picture = picture;
      this.useCamera(prompt);
    });
  }

  async useCamera(prompt: any) {
    try {
      const image = await Camera.getPhoto({
        quality: 80, 
        allowEditing: false,
        saveToGallery: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt, 
        promptLabelHeader: prompt.header,
        promptLabelPhoto: prompt.gallery,
        promptLabelPicture: prompt.picture,
        width: 3000, // Controla el tamaño en bytes de la imagen
      });

      console.log('Imagen:', image);

      const acceptedFormats = ['jpeg', 'png', 'heif', 'heic'];

      // Verifica si el formato de la imagen es aceptado
      if (!acceptedFormats.includes(image.format)) {
        this.errorImg.push('imageFormatError');
        this.imageValue = null;
      }

      // Devuelve base64 con prefijo data URL
      this.imageValue = `data:image/${image.format};base64,${image.base64String}`;
    } catch (error) {
      console.error('Error al tomar la foto', error);
      this.imageValue = null;
    }
  }

  // pin elemento rango muestra un decimal exacto
  formatPin = (value: number): string => {
    return value.toFixed(1); 
  }

  isFeatureEditionsEmpty(): boolean {
    if (!this.featureEditions) return true;

    return Object.values(this.featureEditions).every(edition =>
      (!edition.inserts || edition.inserts.length === 0) &&
      (!edition.updates || edition.updates.length === 0) &&
      (!edition.deletes || edition.deletes.length === 0)
    );
  }

  changeOpacity(event: any, node: TreeNode){
    node.transparency = event.detail.value;
    const layer = this.mapa.getImpl().getAllLayerInGroup().filter((l:any) => [node.resource, node.action].includes(l.idLayer));
    layer.forEach((l: any) => {
      l.setOpacity(node.transparency);
    });
  }

  openMenu() {
    this.profileModal.openProfileModal();
  }

}
