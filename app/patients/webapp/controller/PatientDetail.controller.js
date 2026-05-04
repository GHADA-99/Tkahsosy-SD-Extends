sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "medsync/patients/model/formatter"
], function (Controller, MessageBox, MessageToast, formatter) {
  "use strict";

  return Controller.extend("medsync.patients.controller.PatientDetail", {

    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oModel  = this.getOwnerComponent().getModel();

      var oViewModel = new sap.ui.model.json.JSONModel({
        busy    : false,
        editMode: false
      });
      this.getView().setModel(oViewModel, "view");

      this._oRouter.getRoute("PatientDetail").attachPatternMatched(this._onPatientMatched, this);
    },

    _onPatientMatched: function (oEvent) {
      var sPatientId = oEvent.getParameter("arguments").patientId;
      this._sPatientId = sPatientId;
      this._bindPatient(sPatientId);
    },

    _bindPatient: function (sPatientId) {
      var sPath = "/Patients(" + sPatientId + ")";
      this.getView().bindElement({
        path      : sPath,
        parameters: {
          expand: "appointments($expand=doctor),medicalRecords($expand=doctor),doctors($expand=doctor)"
        },
        events: {
          dataReceived: function (oEvent) {
            var oData = oEvent.getParameter("data");
            if (!oData || !oData.ID) {
              MessageBox.error("Patient not found.");
            }
          }
        }
      });
    },

    onEdit: function () {
      this.getView().getModel("view").setProperty("/editMode", true);
    },

    onSave: function () {
      var oContext = this.getView().getBindingContext();
      if (!oContext) return;

      var that = this;
      this._oModel.submitBatch("$auto").then(function () {
        MessageToast.show("Patient updated successfully.");
        that.getView().getModel("view").setProperty("/editMode", false);
      }).catch(function (oError) {
        MessageBox.error("Failed to save changes: " + (oError.message || "Unknown error"));
      });
    },

    onCancelEdit: function () {
      this._oModel.resetChanges();
      this.getView().getModel("view").setProperty("/editMode", false);
    },

    onNavBack: function () {
      var oHistory = sap.ui.core.routing.History.getInstance();
      var sPrevHash = oHistory.getPreviousHash();
      if (sPrevHash !== undefined) {
        window.history.go(-1);
      } else {
        this._oRouter.navTo("Patients", {}, true);
      }
    },

    onNewAppointment: function () {
      MessageToast.show("Opening appointment creation for this patient…");
      // Navigate to appointments app with patient pre-selected
      window.location.href = "/app/appointments/webapp/index.html?patientId=" + this._sPatientId;
    },

    onViewMedicalRecord: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      var sId      = oContext.getProperty("ID");
      MessageToast.show("Medical record: " + sId);
    }
  });
});
