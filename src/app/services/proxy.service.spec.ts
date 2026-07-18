import { TestBed } from '@angular/core/testing';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let instances: {
    getProxyRequestUrl: jest.Mock;
    getMbtilesProxyUrl: jest.Mock;
    getInstanceUrl: jest.Mock;
    getMiddlewareBaseUrl: jest.Mock;
  };
  let login: {
    ensureProxyToken: jest.Mock;
    getAccessToken: jest.Mock;
    getProxyToken: jest.Mock;
  };
  let httpRequest: jest.SpyInstance;

  beforeEach(() => {
    instances = {
      getProxyRequestUrl: jest.fn().mockResolvedValue(
        'https://gw.example.com/middleware/proxy/1/2/WMS/9'
      ),
      getMbtilesProxyUrl: jest.fn(async (suffix = '') =>
        `https://gw.example.com/middleware/proxy/1/2/mbtiles${suffix}`
      ),
      getInstanceUrl: jest.fn().mockResolvedValue('https://gw.example.com/backend'),
      getMiddlewareBaseUrl: jest.fn().mockResolvedValue('https://gw.example.com/middleware')
    };
    login = {
      ensureProxyToken: jest.fn().mockResolvedValue('proxy-jwt'),
      getAccessToken: jest.fn().mockReturnValue('access-jwt'),
      getProxyToken: jest.fn().mockReturnValue('proxy-jwt')
    };

    TestBed.configureTestingModule({
      providers: [
        ProxyService,
        { provide: InstancesService, useValue: instances },
        { provide: LoginService, useValue: login }
      ]
    });
    service = TestBed.inject(ProxyService);
    httpRequest = jest.spyOn(service as any, 'request').mockResolvedValue({
      data: { ok: true },
      status: 200,
      headers: {},
      url: 'https://gw.example.com/middleware/proxy/1/2/mbtiles/estimate'
    });
  });

  it('sends service/layer IDs to middleware estimate with proxy token', async () => {
    await service.getbgLayerFileWeight(
      [{ serviceId: 10, layerIds: [11, 12] }],
      { minX: 1, minY: 2, maxX: 3, maxY: 4 },
      8,
      'EPSG:3857'
    );
    expect(instances.getMbtilesProxyUrl).toHaveBeenCalledWith('/estimate');
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://gw.example.com/middleware/proxy/1/2/mbtiles/estimate',
        headers: expect.objectContaining({ Authorization: 'Bearer proxy-jwt' }),
        data: expect.objectContaining({
          services: [{ serviceId: 10, layerIds: [11, 12] }],
          srs: 'EPSG:3857'
        })
      })
    );
    expect(JSON.stringify(httpRequest.mock.calls[0][0].data)).not.toContain('http');
  });

  it('attaches proxy token to generic proxy requests', async () => {
    await service.proxyRequest('WMS', '9');
    expect(instances.getProxyRequestUrl).toHaveBeenCalledWith('WMS', '9');
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://gw.example.com/middleware/proxy/1/2/WMS/9',
        headers: expect.objectContaining({ Authorization: 'Bearer proxy-jwt' })
      })
    );
  });
});
