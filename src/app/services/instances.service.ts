import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { exactOrigin } from './trusted-origin.util';

@Injectable({
  providedIn: 'root'
})
export class InstancesService {

  authorizationUrl = '';
  private appId = '';
  private terId = '';

  constructor(private databaseService: DatabaseService) { }

  setAppTerritory(appId: string | number, terId: string | number) {
    this.appId = String(appId);
    this.terId = String(terId);
  }

  async getProxyRequestUrl(type: string, typeId: string): Promise<string> {
    return this.proxyPath(`/${type}/${typeId}`);
  }

  async getInstanceUrl() {
    const instances = await this.databaseService.getInstances();
    let instanceUrl = '';
    if (instances.length > 0) {
      instanceUrl = instances[0].instance;
    }
    this.authorizationUrl = instanceUrl;
    return instanceUrl;
  }

  async getBackendOrigin(): Promise<string | null> {
    return exactOrigin(await this.getInstanceUrl());
  }

  /**
   * Gateway convention: backend base ending with `/backend` maps to sibling `/middleware`.
   * Otherwise middleware is served at `{origin}/middleware`.
   */
  async getMiddlewareBaseUrl(): Promise<string> {
    const backendUrl = await this.getInstanceUrl();
    const parsed = new URL(backendUrl);
    const path = parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = path.endsWith('/backend')
      ? `${path.slice(0, -'/backend'.length)}/middleware`
      : '/middleware';
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  }

  async getMiddlewareOrigin(): Promise<string | null> {
    return exactOrigin(await this.getMiddlewareBaseUrl());
  }

  async getMbtilesProxyUrl(suffix = ''): Promise<string> {
    return this.proxyPath(`/mbtiles${suffix}`);
  }

  private async proxyPath(suffix: string): Promise<string> {
    if (!this.appId || !this.terId) {
      throw new Error('Application and territory context are required');
    }
    const base = await this.getMiddlewareBaseUrl();
    return `${base}/proxy/${this.appId}/${this.terId}${suffix}`;
  }
}
