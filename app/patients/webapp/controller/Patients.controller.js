sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "medsync/patients/model/formatter"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast, formatter) {
  "use strict";

  return Controller.extend("medsync.patients.controller.Patients", {

    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oModel = this.getOwnerComponent().getModel();
      this._oView  = this.getView();

      // Initialise local view model
      var oViewModel = new sap.ui.model.json.JSONModel({
        busy          : true,
        totalCount    : 0,
        searchQuery   : ""
      });
      this._oView.setModel(oViewModel, "view");

      this._oRouter.getRoute("Patients").attachPatternMatched(this._onPatientListMatched, this);
    },

    _onPatientListMatched: function () {
      this._loadPatients();
    },

    _loadPatients: function () {
      var oTable   = this._oView.byId("patientsTable");
      var oBinding = oTable.getBinding("items");
      if (oBinding) {
        oBinding.refresh();
      }
      this.getView().getModel("view").setProperty("/busy", false);
    },

    onSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
      var oTable   = this._oView.byId("patientsTable");
      var oBinding = oTable.getBinding("items");
      if (!oBinding) return;

      var aFilters = [];
      if (sQuery.trim()) {
        aFilters = [
          new Filter({
            filters: [
              new Filter("firstName", FilterOperator.Contains, sQuery),
              new Filter("lastName",  FilterOperator.Contains, sQuery),
              new Filter("email",     FilterOperator.Contains, sQuery)
            ],
            and: false
          })
        ];
      }
      oBinding.filter(aFilters);
    },

    onPatientPress: function (oEvent) {
      var oContext    = oEvent.getSource().getBindingContext();
      var sPatientId  = oContext.getProperty("ID");
      this._oRouter.navTo("PatientDetail", { patientId: sPatientId });
    },

    onCreatePatient: function () {
      this._oRouter.navTo("PatientForm", {});
    },

    onDeletePatient: function (oEvent) {
      var oButton  = oEvent.getSource();
      var oContext = oButton.getBindingContext();
      var sName    = oContext.getProperty("firstName") + " " + oContext.getProperty("lastName");
      var that     = this;

      MessageBox.confirm("Are you sure you want to deactivate patient " + sName + "?", {
        title  : "Confirm Deactivation",
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            oContext.delete("$auto").then(function () {
              MessageToast.show("Patient deactivated successfully.");
              that._loadPatients();
            }).catch(function (oError) {
              MessageBox.error("Failed to deactivate patient: " + (oError.message || "Unknown error"));
            });
          }
        }
      });
    },

    onRefresh: function () {
      this._loadPatients();
      MessageToast.show("Patient list refreshed.");
    },

    onFilterActive: function (oEvent) {
      var bActive  = oEvent.getParameter("selected");
      var oTable   = this._oView.byId("patientsTable");
      var oBinding = oTable.getBinding("items");
      if (!oBinding) return;
      if (bActive) {
        oBinding.filter([new Filter("isActive", FilterOperator.EQ, true)]);
      } else {
        oBinding.filter([]);
      }
    }
  });
});
