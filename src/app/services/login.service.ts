import { Injectable } from '@angular/core';
import { Http } from '@capacitor-community/http';
import { environment } from 'src/environments/environment';
import { DatabaseService } from './database.service';
import { InstancesService } from './instances.service';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  private accessToken = '';
  private proxyToken = '';

  constructor(
    private dbService: DatabaseService,
    private instancesServices: InstancesService
  ) { }

  getToken() {
    return this.accessToken;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getProxyToken() {
    return this.proxyToken;
  }

  logout() {
    if (this.accessToken || this.proxyToken) {
      this.dbService.logoutUser();
    }
    this.accessToken = '';
    this.proxyToken = '';
  }

  async login(user: string, password: string) {
    const base = await this.instancesServices.getInstanceUrl();
    const url = base.concat(environment.authenticationPath);
    const options = {
      url,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      data: {
        username: user,
        password
      },
      params: {}
    };
    const token = await this.request(options, this.authenticateSuccess.bind(this));
    await this.ensureProxyToken();
    return token;
  }

  async ensureProxyToken() {
    if (!this.accessToken) {
      throw new Error('Mobile access token is required');
    }
    if (this.proxyToken) {
      return this.proxyToken;
    }
    const base = await this.instancesServices.getInstanceUrl();
    const url = base.concat('/api/authenticate/proxy');
    const options = {
      url,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`
      },
      params: {},
      data: {}
    };
    return this.request(options, (resp: any) => {
      this.proxyToken = resp.data.proxy_token;
      return this.proxyToken;
    });
  }

  async reissueProxyToken() {
    this.proxyToken = '';
    return this.ensureProxyToken();
  }

  private authenticateSuccess(resp: any) {
    this.accessToken = resp.data.access_token;
    this.proxyToken = '';
    return this.accessToken;
  }

  private request(options: any, callback: Function) {
    return new Promise<any>((resolve, reject) => {
      Http.request(options).then(data => {
        resolve(callback(data));
      }).catch(error => {
        reject(error);
      });
    });
  }
}
