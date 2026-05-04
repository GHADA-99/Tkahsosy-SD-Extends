sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device"
], function (UIComponent, Device) {
  "use strict";

  return UIComponent.extend("medsync.admin.Component", {
    metadata: { manifest: "json" },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      var oDeviceModel = new sap.ui.model.json.JSONModel(Device);
      oDeviceModel.setDefaultBindingMode("OneWay");
      this.setModel(oDeviceModel, "device");

      this.setModel(new sap.ui.model.json.JSONModel({
        totalPatients    : 0,
        totalDoctors     : 0,
        totalAuditLogs   : 0,
        totalAppointments: 0
      }), "adminStats");

      this.getRouter().initialize();
    },

    getContentDensityClass: function () {
      return "sapUiSizeCompact";
    }
  });
});
