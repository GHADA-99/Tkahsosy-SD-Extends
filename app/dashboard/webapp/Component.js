sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device"
], function (UIComponent, Device) {
  "use strict";

  return UIComponent.extend("medsync.dashboard.Component", {
    metadata: { manifest: "json" },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      var oDeviceModel = new sap.ui.model.json.JSONModel(Device);
      oDeviceModel.setDefaultBindingMode("OneWay");
      this.setModel(oDeviceModel, "device");

      // Initialise stats model
      this.setModel(new sap.ui.model.json.JSONModel({
        totalPatients        : 0,
        totalDoctors         : 0,
        totalAppointments    : 0,
        todaysAppointments   : 0,
        pendingNotifications : 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        lastRefresh          : ""
      }), "stats");

      this.getRouter().initialize();
    },

    getContentDensityClass: function () {
      return Device.support.touch ? "sapUiSizeCozy" : "sapUiSizeCompact";
    }
  });
});
