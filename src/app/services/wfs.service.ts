import { Injectable } from '@angular/core';
import { Http } from '@capacitor-community/http';
import { create, convert } from 'xmlbuilder2';
import { ObjectWriterOptions, XMLBuilder, XMLSerializedAsObject } from 'xmlbuilder2/lib/interfaces';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';
import { authHeadersForUrl } from './trusted-origin.util';

@Injectable({
  providedIn: 'root'
})
export class WfsService {

  constructor(
    private instancesService: InstancesService,
    private loginService: LoginService
  ) { }

  getFeatures(url: string, layerName: string, extent: string, mapProj: string) {
    const options: any = {
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      params: {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typename: layerName,
        outputFormat: 'application/json'
      }
    };
    if (extent) {
      options.params['maxExtent'] = extent;
      options.params['bbox'] = extent;
    }
    if (mapProj !== '') {
      options.params['srsName'] = mapProj;
    }
    return this.request(options);
  }

  async saveFeatures(layer: any, featuresEdition: any, mapProj: string): Promise<string> {
    const data = await this.createWFSTrasaction(featuresEdition, layer.name, `${layer.url}?request=DescribeFeatureType`, mapProj);
    const options = {
      url: layer.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml'
      },
      params: {
      },
      data
    };
    console.log(data);
    const resp = await this.request(options);
    if (resp.status === 200) {
      const options: ObjectWriterOptions = { format: "object" };
      const responseXML: any = convert(String(resp.data), options);
      if (responseXML['ows:ExceptionReport']) {
        const exception = responseXML['ows:ExceptionReport']['ows:Exception'];
        return `${layer.name}: ${exception['@exceptionCode']}:${exception['ows:ExceptionText']}`;
      } else {
        layer.refresh();
        return '200';
      }
    }
    return `${layer.name}: Unexpected error ${resp.status}`;
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

  private async request(options: any) {
    await this.loginService.ensureProxyToken();
    const headers = {
      ...options.headers,
      ...(await this.authHeaders(options.url))
    };
    return Http.request({ ...options, headers });
  }

  async createWFSTrasaction(featuresEdition: any, typeName: string, describeFeatureUrl: string, mapProj: string) {
    const describeFeatureType = await this.getDescribeFeatureType(describeFeatureUrl, typeName);
    const layerSplit = typeName.split(':');
    const docProperties: any = {
      'xmlns:wfs': 'http://www.opengis.net/wfs',
      'xmlns:gml': 'http://www.opengis.net/gml',
      'xmlns:ogc': 'http://www.opengis.net/ogc',
      'service': 'WFS',
      'version': '1.1.0',
    };
    docProperties[`xmlns:${layerSplit[0]}`] = describeFeatureType['namespace'];
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('wfs:Transaction', docProperties);
    this.createWFSInsert(doc, layerSplit, featuresEdition['inserts'], mapProj, describeFeatureType['geometryColumnName']);
    this.createWFSUpdate(doc, layerSplit, featuresEdition['updates'], mapProj, describeFeatureType['geometryColumnName']);
    this.createWFSDelete(doc, layerSplit, featuresEdition['deletes']);
    return doc.end({prettyPrint: true, headless: true});
  }

  createWFSInsert(doc: XMLBuilder, layerSplit: string[], inserts: any[], proj: string, geomColumnName: string) {
    inserts.forEach((feature) => {
      const insert = doc.ele('wfs:Insert').ele(`${layerSplit[0]}:${layerSplit[1]}`);
      for (const [key, value] of Object.entries(feature.getAttributes())) {
        if (key !== 'vendor.mapea.click') {
          insert.ele(`${layerSplit[0]}:${key}`).txt(String(value));
        }
      }
      if (feature.getGeometry().type === 'Point') {
        const coordinates = feature.getGeometry().coordinates;
        insert
          .ele(`${layerSplit[0]}:${geomColumnName}`)
          .ele('gml:Point', { srsName: proj })
          .ele('gml:coordinates')
          .txt(`${coordinates[0]},${coordinates[1]}`);
      }
    });
  }

  createWFSUpdate(doc: XMLBuilder, layerSplit: string[], updates: any[], proj: string, geomColumnName: string) {
    updates.forEach((feature) => {
      const update = doc.ele('wfs:Update', { typeName: `${layerSplit[0]}:${layerSplit[1]}` });

      // Propiedades normales
      for (const [key, value] of Object.entries(feature.getAttributes())) {
        if (key !== 'vendor.mapea.click') {
          const prop = update.ele('wfs:Property');
          prop.ele('wfs:Name').txt(key);
          prop.ele('wfs:Value').txt(String(value));
        }
      }

      // Geometría (si existe)
      if (feature.getGeometry().type === 'Point') {
        const geomProp = update.ele('wfs:Property');
        geomProp.ele('wfs:Name').txt(geomColumnName);
        const value = geomProp.ele('wfs:Value');
        const coordinates = feature.getGeometry().coordinates;
        value
          .ele('gml:Point', { srsName: proj })
          .ele('gml:coordinates')
          .txt(`${coordinates[0]},${coordinates[1]}`);
      }

      // Filtro de ID
      update
        .ele('ogc:Filter')
        .ele('ogc:FeatureId', { fid: feature.getId() });
    });
  }

  createWFSDelete(doc: XMLBuilder, layerSplit: string[], deletes: any[]) {
    deletes.forEach((feature) => {
      const del = doc.ele('wfs:Delete', { typeName: `${layerSplit[0]}:${layerSplit[1]}` });
      del
        .ele('ogc:Filter')
        .ele('ogc:FeatureId', { fid: feature.getId() });
    });
  }

  async getDescribeFeatureType(url: string, typeName: string) {
    const options = {
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/xml'
      },
      params: {
        service: 'WFS',
        version: '1.0.0',
        request: 'DescribeFeatureType',
        typename: typeName
      }
    };
    const data = await this.request(options);
    const describeFeatureData: any = {};
    const geometryTypes = ['gml:PointPropertyType', 'gml:PolygonPropertyType', 'gml:LineStringPropertyType'];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.data, 'text/xml');
    describeFeatureData['namespace'] = xmlDoc.documentElement.getAttribute('targetNamespace');
    const elements = Array.from(xmlDoc.getElementsByTagName("xsd:element"));
    const geometryElement = elements.find(el => {
      const type = el.getAttribute("type") || "";
      return geometryTypes.includes(type);
    });
    describeFeatureData['geometryColumnName'] = geometryElement?.getAttribute("name");
    return describeFeatureData;
  }
}
