import { Http } from '@capacitor-community/http';
import { TestBed } from '@angular/core/testing';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';
import { WfsService } from './wfs.service';

jest.mock('@capacitor-community/http', () => ({
  Http: {
    request: jest.fn()
  }
}));

describe('WfsService', () => {
  let service: WfsService;
  let instances: {
    getInstanceUrl: jest.Mock;
    getMiddlewareBaseUrl: jest.Mock;
  };
  let login: {
    ensureProxyToken: jest.Mock;
    getAccessToken: jest.Mock;
    getProxyToken: jest.Mock;
  };

  beforeEach(() => {
    instances = {
      getInstanceUrl: jest.fn().mockResolvedValue('https://gw.example.com/backend'),
      getMiddlewareBaseUrl: jest.fn().mockResolvedValue('https://gw.example.com/middleware')
    };
    login = {
      ensureProxyToken: jest.fn().mockResolvedValue('proxy-jwt'),
      getAccessToken: jest.fn().mockReturnValue('access-jwt'),
      getProxyToken: jest.fn().mockReturnValue('proxy-jwt')
    };

    (Http.request as jest.Mock).mockResolvedValue({
      data: { type: 'FeatureCollection', features: [] },
      status: 200,
      headers: {},
      url: 'https://gw.example.com/middleware/proxy/20/4/WFS/177'
    });

    TestBed.configureTestingModule({
      providers: [
        WfsService,
        { provide: InstancesService, useValue: instances },
        { provide: LoginService, useValue: login }
      ]
    });
    service = TestBed.inject(WfsService);
  });

  afterEach(() => {
    (Http.request as jest.Mock).mockReset();
  });

  it('sends GetFeature to middleware with the proxy Bearer token', async () => {
    await service.getFeatures(
      'https://gw.example.com/middleware/proxy/20/4/WFS/177',
      'ns:layer',
      '1,2,3,4',
      'EPSG:3857'
    );
    expect(login.ensureProxyToken).toHaveBeenCalled();
    expect(Http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://gw.example.com/middleware/proxy/20/4/WFS/177',
        headers: expect.objectContaining({ Authorization: 'Bearer proxy-jwt' }),
        params: expect.objectContaining({
          request: 'GetFeature',
          typename: 'ns:layer',
          srsName: 'EPSG:3857'
        })
      })
    );
  });
});
