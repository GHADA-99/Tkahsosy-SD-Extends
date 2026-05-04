sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (JSONModel, Device) {
  "use strict";

  return {
    createDeviceModel: function () {
      var oModel = new JSONModel(Device);
      oModel.setDefaultBindingMode("OneWay");
      return oModel;
    },

    createViewModel: function (oData) {
      return new JSONModel(Object.assign({
        busy          : false,
        delay         : 0,
        isEdit        : false,
        editMode      : false,
        selectedPatient: null
      }, oData || {}));
    }
  };
});
