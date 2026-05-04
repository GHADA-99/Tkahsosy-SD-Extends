sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("medsync.patients.controller.PatientForm", {

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oModel  = this.getOwnerComponent().getModel();

      this._oFormData = new sap.ui.model.json.JSONModel({
        firstName     : "",
        lastName      : "",
        dateOfBirth   : null,
        gender        : "unspecified",
        email         : "",
        phone         : "",
        street        : "",
        city          : "",
        state         : "",
        zip           : "",
        country       : "",
        medicalHistory: "",
        allergies     : ""
      });
      this.getView().setModel(this._oFormData, "form");

      this._oViewModel = new sap.ui.model.json.JSONModel({ busy: false });
      this.getView().setModel(this._oViewModel, "view");

      this._oRouter.getRoute("PatientForm").attachPatternMatched(this._onFormMatched, this);
    },

    _onFormMatched: function () {
      // Reset form
      this._oFormData.setData({
        firstName: "", lastName: "", dateOfBirth: null, gender: "unspecified",
        email: "", phone: "", street: "", city: "", state: "", zip: "",
        country: "", medicalHistory: "", allergies: ""
      });
    },

    _validateForm: function () {
      var oData = this._oFormData.getData();

      if (!oData.firstName || !oData.firstName.trim()) {
        MessageBox.warning("First name is required.");
        return false;
      }
      if (!oData.lastName || !oData.lastName.trim()) {
        MessageBox.warning("Last name is required.");
        return false;
      }
      if (!oData.email || !oData.email.trim()) {
        MessageBox.warning("Email is required.");
        return false;
      }
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(oData.email.trim())) {
        MessageBox.warning("Please enter a valid email address.");
        return false;
      }
      return true;
    },

    onSave: function () {
      if (!this._validateForm()) return;

      var oData   = this._oFormData.getData();
      var that    = this;
      var oListBinding = this._oModel.bindList("/Patients");

      this._oViewModel.setProperty("/busy", true);

      var oContext = oListBinding.create({
        firstName     : oData.firstName.trim(),
        lastName      : oData.lastName.trim(),
        dateOfBirth   : oData.dateOfBirth || null,
        gender        : oData.gender,
        email         : oData.email.trim(),
        phone         : oData.phone.trim() || null,
        street        : oData.street.trim() || null,
        city          : oData.city.trim() || null,
        state         : oData.state.trim() || null,
        zip           : oData.zip.trim() || null,
        country       : oData.country.trim() || null,
        medicalHistory: oData.medicalHistory || null,
        allergies     : oData.allergies || null,
        isActive      : true
      });

      oContext.created().then(function () {
        that._oViewModel.setProperty("/busy", false);
        MessageToast.show("Patient created successfully!");
        that._oRouter.navTo("Patients", {}, true);
      }).catch(function (oError) {
        that._oViewModel.setProperty("/busy", false);
        var sMsg = oError.error ? oError.error.message : oError.message || "Unknown error";
        MessageBox.error("Failed to create patient: " + sMsg);
      });
    },

    onCancel: function () {
      this._oRouter.navTo("Patients", {}, true);
    },

    onNavBack: function () {
      this.onCancel();
    }
  });
});
