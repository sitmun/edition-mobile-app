import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { DatabaseService } from './database.service';
import { InstancesService } from './instances.service';
import { LoginService } from './login.service';

describe('LoginService', () => {
  let service: LoginService;
  let instances: { getInstanceUrl: jest.Mock };
  let db: { logoutUser: jest.Mock };
  let httpRequest: jest.SpyInstance;

  beforeEach(() => {
    instances = {
      getInstanceUrl: jest.fn().mockResolvedValue('https://gw.example.com/backend')
    };
    db = {
      logoutUser: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        LoginService,
        { provide: InstancesService, useValue: instances },
        { provide: DatabaseService, useValue: db }
      ]
    });
    service = TestBed.inject(LoginService);
    httpRequest = jest.spyOn(service as any, 'request').mockImplementation(
      async (...args: unknown[]) => {
        const options = args[0] as { url: string };
        const callback = args[1] as (resp: any) => unknown;
        const base = { status: 200, headers: {}, url: options.url };
        if (String(options.url).endsWith(environment.authenticationPath)) {
          return callback({
            ...base,
            data: { access_token: 'access-jwt', token_type: 'Bearer', expires_in: 3600 }
          });
        }
        if (String(options.url).endsWith('/api/authenticate/proxy')) {
          return callback({ ...base, data: { proxy_token: 'proxy-jwt' } });
        }
        throw new Error(`Unexpected URL ${options.url}`);
      }
    );
  });

  it('logs in through authenticationPath and stores access_token', async () => {
    await service.login('user', 'secret');
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://gw.example.com/backend${environment.authenticationPath}`,
        data: { username: 'user', password: 'secret' }
      }),
      expect.any(Function)
    );
    expect(service.getAccessToken()).toBe('access-jwt');
  });

  it('exchanges access_token for proxy_token after login', async () => {
    await service.login('user', 'secret');
    expect(service.getProxyToken()).toBe('proxy-jwt');
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://gw.example.com/backend/api/authenticate/proxy',
        headers: expect.objectContaining({ Authorization: 'Bearer access-jwt' })
      }),
      expect.any(Function)
    );
  });

  it('clears both tokens on logout', async () => {
    await service.login('user', 'secret');
    service.logout();
    expect(service.getAccessToken()).toBe('');
    expect(service.getProxyToken()).toBe('');
    expect(db.logoutUser).toHaveBeenCalled();
  });
});
