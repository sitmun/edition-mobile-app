import { authHeadersForUrl, exactOrigin, matchesTrustedBase } from './trusted-origin.util';

describe('trusted-origin.util', () => {
  it('extracts exact origins', () => {
    expect(exactOrigin('https://api.example.com:8443/backend')).toBe('https://api.example.com:8443');
    expect(exactOrigin('not-a-url')).toBeNull();
  });

  it('matches trusted bases by origin and path prefix', () => {
    expect(
      matchesTrustedBase(
        'https://gw.example.com/middleware/proxy/1/2/WMS/9',
        'https://gw.example.com/middleware'
      )
    ).toBe(true);
    expect(
      matchesTrustedBase(
        'https://gw.example.com/backend/api/authenticate/mobile',
        'https://gw.example.com/backend'
      )
    ).toBe(true);
    expect(
      matchesTrustedBase(
        'https://gw.example.com/backend-evil/api',
        'https://gw.example.com/backend'
      )
    ).toBe(false);
  });

  it('adds access token only for backend base', () => {
    const headers = authHeadersForUrl(
      'https://gw.example.com/backend/api/config/client/application',
      'https://gw.example.com/backend',
      'https://gw.example.com/middleware',
      'access',
      'proxy'
    );
    expect(headers).toEqual({ Authorization: 'Bearer access' });
  });

  it('adds proxy token for middleware on same-origin gateway', () => {
    const headers = authHeadersForUrl(
      'https://gw.example.com/middleware/proxy/1/2/mbtiles/estimate',
      'https://gw.example.com/backend',
      'https://gw.example.com/middleware',
      'access',
      'proxy'
    );
    expect(headers).toEqual({ Authorization: 'Bearer proxy' });
  });

  it('adds proxy token when middleware is on a different host', () => {
    const headers = authHeadersForUrl(
      'https://mw.example.com/proxy/1/2/mbtiles/estimate',
      'https://gw.example.com/backend',
      'https://mw.example.com',
      'access',
      'proxy'
    );
    expect(headers).toEqual({ Authorization: 'Bearer proxy' });
  });

  it('omits Authorization for third-party and deceptive hosts', () => {
    expect(
      authHeadersForUrl(
        'https://evil-gw.example.com/backend',
        'https://gw.example.com/backend',
        'https://gw.example.com/middleware',
        'access',
        'proxy'
      )
    ).toEqual({});
    expect(
      authHeadersForUrl(
        'https://tiles.example.com/wmts',
        'https://gw.example.com/backend',
        'https://gw.example.com/middleware',
        'access',
        'proxy'
      )
    ).toEqual({});
  });
});
