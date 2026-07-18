import { Injectable } from '@angular/core';
import { Http } from '@capacitor-community/http';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';
import { authHeadersForUrl } from './trusted-origin.util';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationService {

  private filter: Function = (_obj: any) => true;
  authorizationUrl = '';
  private profileData: any;

  constructor(
    private loginService: LoginService,
    private instancesServices: InstancesService
  ) { }

  async getApplications() {
    const url = (await this.instancesServices.getInstanceUrl()).concat('/api/config/client/application');
    const options = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(await this.authHeaders(url))
      },
      params: {}
    };
    this.filter = (a: any) => a.type === 'ED';
    return this.request(options, this.filterCallback.bind(this));
  }

  async getTerritoriesByApp(idApp: Number) {
    const url = (await this.instancesServices.getInstanceUrl())
      .concat(`/api/config/client/application/${idApp}/territories`);
    const options = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(await this.authHeaders(url))
      },
      params: {}
    };
    return this.request(options, this.basicCallback);
  }

  async getProfile(idApp: Number, idTer: Number) {
    this.instancesServices.setAppTerritory(idApp as number, idTer as number);
    const url = (await this.instancesServices.getInstanceUrl())
      .concat(`/api/config/client/profile/${idApp}/${idTer}`);
    const options = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(await this.authHeaders(url))
      },
      params: {}
    };
    return this.request(options, this.profileCallback.bind(this));
  }

  getProfileData() {
    return this.profileData;
  }

  private async authHeaders(url: string) {
    return authHeadersForUrl(
      url,
      await this.instancesServices.getInstanceUrl(),
      await this.instancesServices.getMiddlewareBaseUrl(),
      this.loginService.getAccessToken(),
      this.loginService.getProxyToken()
    );
  }

  private profileCallback(resp: any) {
    this.profileData = resp.data;
    return resp.data;
  }

  private basicCallback(resp: any) {
    return resp.data.content ? resp.data.content : resp.data;
  }

  private filterCallback(resp: any) {
    return resp.data.content.filter((obj: any) => this.filter(obj));
  }

  private request(options: any, callback: Function) {
    return new Promise<any>((resolve, reject) => {
      Http.request(options).then(resp => {
        resolve(callback(resp));
      }).catch(error => {
        reject(error);
      });
    });
  }
}
