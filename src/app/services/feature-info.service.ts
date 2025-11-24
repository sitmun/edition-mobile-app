import { Injectable } from '@angular/core';
import { LanguageService } from './language.service';

declare var M: any;
declare var ol: any;

@Injectable({
  providedIn: 'root'
})
export class FeatureInfoService {

  control: any;
  controlImpl: any;

  constructor(private langService: LanguageService) { }

  init(plugin: any) {
    this.control = plugin.controls_[0];
    if (plugin) {
      this.controlImpl = this.control.getImpl();
      this.controlImpl.buildWMSInfoURL = this.buildWMSInfoURL.bind(this);
      this.activate();
    }
  }

  buildWMSInfoURL(wmsLayers: any[]) {
    const olMap = this.controlImpl.facadeMap_.getMapImpl();
    const viewResolution = olMap.getView().getResolution();
    const srs = this.controlImpl.facadeMap_.getProjection().code;
    return wmsLayers.map((layer) => {
      const olLayer = layer.getImpl().getOL3Layer();
      let param;
      if (layer.isVisible() && layer.isQueryable() && !M.utils.isNullOrEmpty(olLayer)) {
        param = {};
        const informationParams: any = {
          INFO_FORMAT: this.controlImpl.format_,
          FEATURE_COUNT: this.controlImpl.featureCount_,
          LANG: this.langService.getLanguage(),
        };
        const regexBuffer = /buffer/i;
        const source = olLayer.getSource();
        const coord = this.controlImpl.evt.coordinate;
        if (!regexBuffer.test(layer.url)) {
          informationParams.BUFFER = this.controlImpl.buffer_;
        }
        const url = source.getFeatureInfoUrl(coord, viewResolution, srs, informationParams);
        param = { layer: layer.legend || layer.name, url };
      }
      return param;
    });
  }

  activate() {
    this.control.activate();
  }

  deactivate() {
    this.control.deactivate();
  }
}
