import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';
import { InstancesService } from './instances.service';

describe('InstancesService', () => {
  let service: InstancesService;
  let database: { getInstances: jest.Mock };

  beforeEach(() => {
    database = {
      getInstances: jest.fn().mockResolvedValue([
        { instance: 'https://gw.example.com/backend' }
      ])
    };
    TestBed.configureTestingModule({
      providers: [
        InstancesService,
        { provide: DatabaseService, useValue: database }
      ]
    });
    service = TestBed.inject(InstancesService);
  });

  it('builds middleware proxy URLs from the instance backend base', async () => {
    service.setAppTerritory(1, 2);
    await expect(service.getProxyRequestUrl('WMS', '9')).resolves.toBe(
      'https://gw.example.com/middleware/proxy/1/2/WMS/9'
    );
    await expect(service.getMbtilesProxyUrl('/estimate')).resolves.toBe(
      'https://gw.example.com/middleware/proxy/1/2/mbtiles/estimate'
    );
  });

  it('rejects proxy URLs without application/territory context', async () => {
    await expect(service.getProxyRequestUrl('WMS', '9')).rejects.toThrow(
      /Application and territory context are required/
    );
  });
});
