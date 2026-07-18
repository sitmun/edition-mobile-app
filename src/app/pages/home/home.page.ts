import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { LanguageService } from 'src/app/services/language.service';
import { LoginService } from 'src/app/services/login.service';
import { Router } from '@angular/router';
import { DatabaseService } from 'src/app/services/database.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NetworkService } from 'src/app/services/network.service';
import { AuthorizationService } from 'src/app/services/authorization.service';

const LABELS: Record<string, string> = {
  title: 'exit.title',
  message: 'exit.message',
  exit: 'exit.exit',
  continue: 'exit.continue'
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {

  private subscriptionBack: any = null;
  messages_: any = {};
  selectedLanguage: string | null = null;
  languageOptions: any[] = [];
  networkConnected = true;
  loginForm: FormGroup;
  loginusers: any[] = [];
  offline = {
    instances: new Array(),
    users: new Array()
  }
  loginError = false;
  errorMsgKey = '';
  dbinit = false;
  isModalOpen = false;
  instanceDB: string = '';

  constructor(private platform: Platform, private authorizationService: AuthorizationService, private router: Router,
    private alertController: AlertController, private languageService: LanguageService, private loginService: LoginService,
    private databaseService: DatabaseService, private formBuilder: FormBuilder, private networkService: NetworkService
  ) {
    this.loginForm = this.formBuilder.group({
      instance: ['', Validators.required],
      user: ['', null],
      password: ['', null]
    });
  }

  async ionViewWillEnter() {
    this.selectedLanguage = this.languageService.getLanguage();
    this.languageOptions = this.languageService.getLanguageOptions();
    this.loginService.logout();
    this.instanceDB = this.loginForm.value.instance;
    this.loginForm.reset();
    this.loginForm.patchValue({
      instance: this.instanceDB
    });
    if (this.dbinit) {
      this.updateNetworkStatus(await this.networkService.getStatus());
      this.networkService.addListener(this.updateNetworkStatus.bind(this));
    }
  }

  ionViewDidEnter() {
    this.subscriptionBack = this.platform.backButton.subscribeWithPriority(-1, (evt) => {
      this.showExitMessage();
    });
  }

  ionViewDidLeave() {
    if(this.subscriptionBack){
      this.subscriptionBack.unsubscribe();
      this.subscriptionBack = null;
    }
  }

  ngOnInit() {
    this._loadLang();
    this.languageService.subscribeLang(this._loadLang);
    this.platform.ready().then(() => {
      this.initialice();
    });
  }

  async initialice() {
    if (!this.dbinit) {
      await this.databaseService.initPublicDatabase();
      this.dbinit = true;
    }
    const instances = await this.databaseService.getInstances();
    if (instances.length > 0) {
      this.instanceDB = instances[0].instance;
      this.loginForm.patchValue({
        instance: this.instanceDB
      });
    }
    this.updateNetworkStatus(await this.networkService.getStatus());
    this.networkService.addListener(this.updateNetworkStatus.bind(this));
  }

  ngOnDestroy(): void {
    this.languageService.unsubscribeLang();
  }

  access() {
    this.loginForm.get('instance')?.markAsTouched();
    if (this.loginForm.valid) {
      this.authorizationService.authorizationUrl = this.instanceDB;
      const formValue = this.loginForm.value;
      if (this.networkConnected) {
        this.loginService.login(formValue.user, formValue.password).then(resp => {
          if (resp) {
            this.login(formValue);
          } else {
            this.errorMsgKey = 'home.loginError';
            this.loginError = true;
          }
        }).catch(error => {
          console.error('Login error:', error);
          this.errorMsgKey = 'home.loginError';
          this.loginError = true;
        });
      } else {
        this.login(formValue);
      }
    } else {
      this.errorMsgKey = 'home.instanceRequired';
      this.loginError = true;
    }
  }

  async login(formValue: any) {
    this.loginError = false;
    await this.databaseService.insertUserLogin(formValue.user);
    await this.databaseService.initUserDatabase(formValue.user);
    this.nextPage();
  }

  nextPage() {
    this.router.navigate(['applist']);
  }

  async showExitMessage() {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Salir',
      message: '¿Quiere salir de la aplicación?',
      buttons: [
        {
          text: 'Salir',
          cssClass: 'secondary',
          handler: (blah) => {
            //navigator['app'].exitApp();
            console.log('exit app');
          }
        }, {
          text: 'Continuar',
          cssClass: 'secondary',
          handler: () => {
            console.log('Continue');
          }
        }
      ]
    });
    await alert.present();
  }
  
  private _loadLang = () => {
    this.messages_ = this.languageService.loadLang(LABELS);
  }

  setLanguage(langCode: string) {
    this.selectedLanguage = langCode;
    this.languageService.setLanguage(langCode);
  }

  updateNetworkStatus(connected: boolean) {
    console.log('Network status updated:', connected);
    this.networkConnected = connected;
    if (!connected) {
      this.getCachedUsers();
    }
  }

  async getCachedUsers() {
    console.log('Network disconnected, fetching cached users');
    this.loginusers = await this.databaseService.getLoginUsers();
    this.refreshOfflineUsers();
  }

  refreshOfflineUsers() {
    this.offline.users = this.loginusers.map(u => u.name);
  }

  openInstance(){
    this.isModalOpen = true;
  }

  closeModal(){
    this.isModalOpen = false;
  }

  async saveInstance(){
    await this.databaseService.insertInstance(this.instanceDB);
    console.log(this.instanceDB);
    this.isModalOpen = false;
    this.loginForm.patchValue({
      instance: this.instanceDB
    });
  }
}
