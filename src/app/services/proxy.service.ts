import { Injectable } from '@angular/core';
import { Directory } from '@capacitor/filesystem';
import { Http } from '@capacitor-community/http';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';
import { authHeadersForUrl } from './trusted-origin.util';

export interface MbtilesServiceRef {
  serviceId: number;
  layerIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class ProxyService {

  constructor(
    private instancesService: InstancesService,
    private loginService: LoginService
  ) { }

  async proxyRequest(type: string, typeId: string) {
    await this.loginService.ensureProxyToken();
    const url = await this.instancesService.getProxyRequestUrl(type, typeId);
    const options = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(await this.authHeaders(url))
      },
      params: {}
    };
    return this.request(options).then(data => data.data);
  }

  async sendbgLayerServices(
    services: MbtilesServiceRef[],
    extent: any,
    zoom: number,
    projection: string
  ) {
    await this.loginService.ensureProxyToken();
    const url = await this.instancesService.getMbtilesProxyUrl('');
    const options = {
      url,
      method: 'POST',
      headers: {
        Accept: 'text/plain, application/json',
        'Content-Type': 'application/json',
        ...(await this.authHeaders(url))
      },
      data: this.mbtilesBody(services, extent, zoom, projection),
      params: {}
    };
    return this.request(options);
  }

  async getbgLayerFileWeight(
    services: MbtilesServiceRef[],
    extent: any,
    zoom: number,
    projection: string
  ) {
    await this.loginService.ensureProxyToken();
    const url = await this.instancesService.getMbtilesProxyUrl('/estimate');
    const options = {
      url,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(await this.authHeaders(url))
      },
      data: this.mbtilesBody(services, extent, zoom, projection),
      params: {}
    };
    return this.request(options);
  }

  async checkbgServices(jobHandle: string) {
    await this.loginService.ensureProxyToken();
    const url = await this.instancesService.getMbtilesProxyUrl(`/${jobHandle}`);
    const options = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(await this.authHeaders(url))
      },
      params: {}
    };
    return this.request(options);
  }

  async downloadMbtilesFile(jobHandle: string, path: string) {
    await this.loginService.ensureProxyToken();
    const url = await this.instancesService.getMbtilesProxyUrl(`/${jobHandle}/file`);
    return Http.downloadFile({
      url,
      filePath: path,
      fileDirectory: Directory.Data,
      headers: await this.authHeaders(url),
      progress: true
    });
  }

  private mbtilesBody(
    services: MbtilesServiceRef[],
    extent: any,
    zoom: number,
    projection: string
  ) {
    return {
      services,
      bbox: {
        minX: Number(extent.minX),
        minY: Number(extent.minY),
        maxX: Number(extent.maxX),
        maxY: Number(extent.maxY)
      },
      minZoom: zoom - 1,
      maxZoom: zoom + 1,
      srs: projection
    };
  }

  private async authHeaders(url: string) {
    return authHeadersForUrl(
      url,
      await this.instancesService.getInstanceUrl(),
      await this.instancesService.getMiddlewareBaseUrl(),
      this.loginService.getAccessToken(),
      this.loginService.getProxyToken()
    );
  }

  private request(options: any) {
    return new Promise<any>((resolve, reject) => {
      Http.request(options).then(resp => {
        resolve(resp);
      }).catch(error => {
        reject(error);
      });
    });
  }
}
