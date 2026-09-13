import { Component, OnInit, ViewChild } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { applicationListLabel } from 'src/app/application-list-label';
import { AuthorizationService } from 'src/app/services/authorization.service';
import { DatabaseService } from 'src/app/services/database.service';
import { LanguageService } from 'src/app/services/language.service';
import { NetworkService } from 'src/app/services/network.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AnimationController } from '@ionic/angular';
import { ProfileModalComponent } from 'src/app/components/profile-modal/profile-modal.component';

@Component({
  selector: 'app-applist',
  templateUrl: './applist.page.html',
  styleUrls: ['./applist.page.scss'],
})
export class ApplistPage implements OnInit {

  readonly applicationListLabel = applicationListLabel;
  messages_: any = {}
  applications: any[] = [];
  territories: any[] = [];
  selectedTerritory: any = {};
  selectedTerritoryId: number = 0;
  selectedApp: any = {};
  isModalOpen = false;
  nextPage = 'map';
  networkConnected = true;
  @ViewChild('profileModal') profileModal!: ProfileModalComponent;

  constructor(private languageService: LanguageService, private router: Router,
    private authorizationService: AuthorizationService, private networkService: NetworkService,
    private databaseService: DatabaseService, private animationCtrl: AnimationController) {

  }

  async ionViewWillEnter() {
    this.updateNetworkStatus(await this.networkService.getStatus());
    this.networkService.addListener(this.updateNetworkStatus.bind(this));
    this.refreshApplications();
  }

  ngOnInit() {
    //this.refreshApplications();
  }

  async refreshApplications() {
    if (this.networkConnected) {
      await this.getApplications();
    } else {
      await this.getOfflineApplications();
    }
    for (const app of this.applications) {
        //this.layers[app.id] = await this.databaseService.getLayersByApp(app.id);
        const { layersSizeBytes, layersSizeMBytes } = await this.getDatabaseWeight(app.id);
        app.layersSizeBytes = layersSizeBytes;
        app.layersSizeMBytes = layersSizeMBytes;
    }
  }

  async getApplications() {
    try{
      const resp = await this.authorizationService.getApplications();
      this.applications = resp.filter((app: any) => !app.isUnavailable);
    }catch(error) {
      console.log('Error obteniendo las aplicaciones disponibles:', error);
    };
  }

  async getOfflineApplications() {
    this.applications = await this.databaseService.getApps();
  }

  async getTerritoriesByApp(idApp: Number) {
    if (this.networkConnected) {
      this.territories = (await this.authorizationService.getTerritoriesByApp(idApp));
    } else {
      this.territories = await this.databaseService.getTerritoriesByApp(idApp);
    }
  }

  private async getDatabaseWeight(appId: number): Promise<Record<string, number>> {
    const size = {layersSizeBytes: 0, layersSizeMBytes: 0};
    const layers = await this.databaseService.getLayersByApp(appId);
    const json = JSON.stringify(layers);
    const blob = new Blob([json], { type: 'application/json' });
    size.layersSizeBytes = blob.size;

    const territories = await this.databaseService.getTerritoriesByApp(appId);
    for (const ter of territories) {
      const id = appId + '_' + ter.id; 
      const fileName = `bgMapa_${id}.mbtiles`;

      try {
        const info = await Filesystem.stat({
          path: fileName,
          directory: Directory.Data
        });
        size.layersSizeBytes += info.size;
        const bgMapSizeMB = Math.round(info.size / (1024 * 1024) * 10) / 10;
        console.log(`Archivo MBTiles encontrado para app ${appId} y territorio ${ter.id}, tamaño: ${bgMapSizeMB} MB`);
      } catch (error) {
        console.log(`Archivo no existe en app ${appId} y territorio ${ter.id}, no es necesario calcular su peso: ${error}`);
      }      
    }
    size.layersSizeMBytes = Math.round(size.layersSizeBytes/ (1024 * 1024) * 10) / 10;
    console.log(`Tamaño total de app ${appId}: ${size.layersSizeMBytes} MB`);
    return size;
  }

  async mapPage(app: any) {
    this.selectedApp = app;
    await this.getTerritoriesByApp(this.selectedApp.id);
    this.selectedTerritory = this.territories[0];
    this.selectedTerritoryId = this.selectedTerritory.id;
    this.nextPage = 'map';
    if (this.territories.length === 1) {
      this.openMap();
    } else {
      this.openTerritoryModal();
    }
  }

  openTerritoryModal() {
    this.isModalOpen = true;
  }

  closeTerritoryModal(openPage: boolean) {
    this.isModalOpen = false;
    if (openPage) {
      this.selectedTerritory = this.territories.find(t => t.id === this.selectedTerritoryId);
      if (this.nextPage === 'map') {
        setTimeout(this.openMap.bind(this), 500);
      } else if (this.nextPage === 'download') {
        setTimeout(this.openDownload.bind(this), 500);
      }
    }
  }

  openMenu() {
    this.profileModal.openProfileModal();
  }

  openMap() {
    console.log(`App: ${this.selectedApp.id}, Terr: ${this.selectedTerritory}`);
    const navigationExtras: NavigationExtras = {
      state: {
        app: this.selectedApp,
        ter: this.selectedTerritory
      }
    };
    this.router.navigate(['map'], navigationExtras);
  }

  async downloadPage(app: any) {
    this.selectedApp = app;
    await this.getTerritoriesByApp(this.selectedApp.id);
    this.selectedTerritory = this.territories[0];
    this.selectedTerritoryId = this.selectedTerritory.id;
    this.nextPage = 'download';
    if (this.territories.length === 1) {
      this.openDownload();
    } else {
      this.openTerritoryModal();
    }    
  }

  openDownload() {
    const navigationExtras: NavigationExtras = {
      state: {
        app: this.selectedApp,
        ter: this.selectedTerritory
      }
    };
    this.navigate('download', navigationExtras);
  }

  navigate(path: string, navigationExtras: NavigationExtras) {
    this.router.navigate([path], navigationExtras);
  }

  updateNetworkStatus(connected: boolean) {
    if (this.networkConnected !== connected) {
      this.networkConnected = connected;
      this.refreshApplications();
    }
  }  
}
