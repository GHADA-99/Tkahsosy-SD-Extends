sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("medsync.appointments.controller.Appointments", {

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oModel  = this.getOwnerComponent().getModel();

      this._oViewModel = new sap.ui.model.json.JSONModel({
        busy         : false,
        viewMode     : "list",   // "list" | "calendar"
        filterStatus : "all",
        filterDate   : null,
        filterDoctor : ""
      });
      this.getView().setModel(this._oViewModel, "view");

      this._oRouter.getRoute("Appointments").attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function () {
      this._refreshTable();
    },

    _refreshTable: function () {
      var oTable   = this.byId("appointmentsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (oBinding) oBinding.refresh();
    },

    // ── View mode toggle ────────────────────────────────────────────────────────

    onToggleView: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      this._oViewModel.setProperty("/viewMode", sKey);
    },

    // ── Search / Filter ─────────────────────────────────────────────────────────

    onSearch: function (oEvent) {
      var sQuery   = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
      this._applyFilters(sQuery);
    },

    onStatusFilterChange: function (oEvent) {
      var sStatus = oEvent.getParameter("selectedItem").getKey();
      this._oViewModel.setProperty("/filterStatus", sStatus);
      this._applyFilters();
    },

    _applyFilters: function (sSearch) {
      var oTable   = this.byId("appointmentsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) return;

      var aFilters = [];
      var sStatus  = this._oViewModel.getProperty("/filterStatus");

      if (sStatus && sStatus !== "all") {
        aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
      }
      if (sSearch && sSearch.trim()) {
        aFilters.push(new Filter({
          filters: [
            new Filter("notes",           FilterOperator.Contains, sSearch),
            new Filter("appointmentType", FilterOperator.Contains, sSearch)
          ],
          and: false
        }));
      }
      oBinding.filter(aFilters.length > 1
        ? [new Filter({ filters: aFilters, and: true })]
        : aFilters);
    },

    // ── CRUD actions ────────────────────────────────────────────────────────────

    onCreateAppointment: function () {
      var oDialog = this._getCreateDialog();
      oDialog.open();
    },

    _getCreateDialog: function () {
      if (!this._oCreateDialog) {
        var oController = this;
        this._oNewAppt  = new sap.ui.model.json.JSONModel({
          patient_ID     : "",
          doctor_ID      : "",
          scheduledDate  : "",
          duration       : 30,
          appointmentType: "consultation",
          notes          : ""
        });
        this.getView().setModel(this._oNewAppt, "newAppt");

        this._oCreateDialog = new sap.m.Dialog({
          title          : "New Appointment",
          contentWidth   : "480px",
          beginButton    : new sap.m.Button({
            text   : "Create",
            type   : "Emphasized",
            press  : function () { oController._saveNewAppointment(); }
          }),
          endButton: new sap.m.Button({
            text : "Cancel",
            press: function () { oController._oCreateDialog.close(); }
          }),
          content: [
            new sap.ui.layout.form.SimpleForm({
              layout : "ColumnLayout",
              editable: true,
              content: [
                new sap.m.Label({ text: "Patient ID", required: true }),
                new sap.m.Input({ value: "{newAppt>/patient_ID}", placeholder: "Patient UUID" }),
                new sap.m.Label({ text: "Doctor ID", required: true }),
                new sap.m.Input({ value: "{newAppt>/doctor_ID}", placeholder: "Doctor UUID" }),
                new sap.m.Label({ text: "Date & Time", required: true }),
                new sap.m.DateTimePicker({
                  value        : "{newAppt>/scheduledDate}",
                  valueFormat  : "yyyy-MM-dd'T'HH:mm:ss",
                  displayFormat: "MMM d, yyyy HH:mm"
                }),
                new sap.m.Label({ text: "Duration (min)" }),
                new sap.m.StepInput({ value: "{newAppt>/duration}", min: 15, max: 240, step: 15 }),
                new sap.m.Label({ text: "Type" }),
                new sap.m.Select({
                  selectedKey: "{newAppt>/appointmentType}",
                  items: [
                    new sap.ui.core.Item({ key: "consultation",  text: "Consultation" }),
                    new sap.ui.core.Item({ key: "follow-up",     text: "Follow-Up" }),
                    new sap.ui.core.Item({ key: "checkup",       text: "Checkup" }),
                    new sap.ui.core.Item({ key: "surgery",       text: "Surgery" }),
                    new sap.ui.core.Item({ key: "emergency",     text: "Emergency" })
                  ]
                }),
                new sap.m.Label({ text: "Notes" }),
                new sap.m.TextArea({ value: "{newAppt>/notes}", rows: 3 })
              ]
            })
          ]
        });
        this.getView().addDependent(this._oCreateDialog);
      }
      return this._oCreateDialog;
    },

    _saveNewAppointment: function () {
      var oData    = this._oNewAppt.getData();
      var oBinding = this._oModel.bindList("/Appointments");
      var that     = this;

      if (!oData.patient_ID || !oData.doctor_ID || !oData.scheduledDate) {
        MessageBox.warning("Patient, Doctor and Date/Time are required.");
        return;
      }

      var oContext = oBinding.create({
        patient_ID     : oData.patient_ID,
        doctor_ID      : oData.doctor_ID,
        scheduledDate  : oData.scheduledDate,
        duration       : oData.duration || 30,
        appointmentType: oData.appointmentType,
        notes          : oData.notes || null,
        status         : "scheduled"
      });

      oContext.created().then(function () {
        MessageToast.show("Appointment created successfully.");
        that._oCreateDialog.close();
        that._refreshTable();
      }).catch(function (oErr) {
        var sMsg = oErr.error ? oErr.error.message : (oErr.message || "Unknown error");
        MessageBox.error("Failed to create appointment: " + sMsg);
      });
    },

    onCancelAppointment: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      var sId      = oContext.getProperty("ID");
      var that     = this;

      MessageBox.confirm("Cancel this appointment?", {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) return;
          var oOperation = that._oModel.bindContext(
            "MedSyncService.cancelAppointment(...)",
            oContext
          );
          oOperation.setParameter("reason", "Cancelled by user");
          oOperation.execute().then(function () {
            MessageToast.show("Appointment cancelled.");
            that._refreshTable();
          }).catch(function (oErr) {
            MessageBox.error("Cancel failed: " + (oErr.message || "Unknown error"));
          });
        }
      });
    },

    onCompleteAppointment: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      var that     = this;
      var oOperation = this._oModel.bindContext(
        "MedSyncService.completeAppointment(...)",
        oContext
      );
      oOperation.execute().then(function () {
        MessageToast.show("Appointment marked as completed.");
        that._refreshTable();
      }).catch(function (oErr) {
        MessageBox.error("Failed: " + (oErr.message || "Unknown error"));
      });
    },

    onRefresh: function () {
      this._refreshTable();
      MessageToast.show("Refreshed.");
    },

    // ── Formatter helpers (inline) ──────────────────────────────────────────────

    formatStatus: function (sStatus) {
      var map = {
        scheduled    : "Scheduled",
        completed    : "Completed",
        cancelled    : "Cancelled",
        "no-show"    : "No Show",
        rescheduled  : "Rescheduled",
        "in-progress": "In Progress"
      };
      return (sStatus && map[sStatus]) || sStatus || "";
    },

    formatStatusState: function (sStatus) {
      var map = {
        scheduled    : "Information",
        completed    : "Success",
        cancelled    : "Error",
        "no-show"    : "Warning",
        rescheduled  : "Warning",
        "in-progress": "Success"
      };
      return (sStatus && map[sStatus]) || "None";
    },

    formatDate: function (sDate) {
      if (!sDate) return "";
      try {
        return new Date(sDate).toLocaleString("en-US", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
      } catch (e) { return sDate; }
    }
  });
});
