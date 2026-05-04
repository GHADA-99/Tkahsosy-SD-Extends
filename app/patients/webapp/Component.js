sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "medsync/patients/model/models"
], function (UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("medsync.patients.Component", {

    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      this.setModel(models.createDeviceModel(), "device");
      this.getRouter().initialize();
    },

    destroy: function () {
      UIComponent.prototype.destroy.apply(this, arguments);
    },

    getContentDensityClass: function () {
      if (!this._sContentDensityClass) {
        if (!Device.support.touch) {
          this._sContentDensityClass = "sapUiSizeCompact";
        } else {
          this._sContentDensityClass = "sapUiSizeCozy";
        }
      }
      return this._sContentDensityClass;
    }
  });
});
