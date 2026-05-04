sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("medsync.admin.controller.Admin", {

    onInit: function () {
      this._oRouter    = this.getOwnerComponent().getRouter();
      this._oModel     = this.getOwnerComponent().getModel();
      this._oAdminStats = this.getOwnerComponent().getModel("adminStats");

      this.getView().setModel(this._oAdminStats, "adminStats");

      var oViewModel = new sap.ui.model.json.JSONModel({
        busy         : false,
        selectedTab  : "auditLogs",
        auditFilter  : "all",
        searchQuery  : ""
      });
      this.getView().setModel(oViewModel, "view");

      this._oRouter.getRoute("Admin").attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function () {
      this._loadSystemStats();
      this._refreshAuditLogs();
    },

    _loadSystemStats: async function () {
      try {
        var results = await Promise.all([
          fetch("/api/Patients?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Doctors?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Appointments?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/AuditLogs?$count=true&$top=0").then(function (r) { return r.json(); })
        ]);

        this._oAdminStats.setData({
          totalPatients    : results[0]["@odata.count"] || 0,
          totalDoctors     : results[1]["@odata.count"] || 0,
          totalAppointments: results[2]["@odata.count"] || 0,
          totalAuditLogs   : results[3]["@odata.count"] || 0
        });
      } catch (err) {
        console.warn("Admin stats load failed:", err.message);
      }
    },

    _refreshAuditLogs: function () {
      var oTable   = this.byId("auditLogsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (oBinding) oBinding.refresh();
    },

    onTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("selectedKey");
      this.getView().getModel("view").setProperty("/selectedTab", sKey);
      if (sKey === "auditLogs")  this._refreshAuditLogs();
      if (sKey === "systemStats") this._loadSystemStats();
    },

    onSearchAuditLog: function (oEvent) {
      var sQuery   = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
      var oTable   = this.byId("auditLogsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) return;

      var aFilters = [];
      if (sQuery.trim()) {
        aFilters = [new Filter({
          filters: [
            new Filter("userId",   FilterOperator.Contains, sQuery),
            new Filter("action",   FilterOperator.Contains, sQuery),
            new Filter("entity",   FilterOperator.Contains, sQuery),
            new Filter("entityId", FilterOperator.Contains, sQuery)
          ],
          and: false
        })];
      }
      oBinding.filter(aFilters);
    },

    onFilterAuditAction: function (oEvent) {
      var sAction  = oEvent.getParameter("selectedItem").getKey();
      var oTable   = this.byId("auditLogsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) return;

      if (sAction === "all") {
        oBinding.filter([]);
      } else {
        oBinding.filter([new Filter("action", FilterOperator.EQ, sAction)]);
      }
    },

    onRefreshAuditLogs: function () {
      this._refreshAuditLogs();
      MessageToast.show("Audit logs refreshed.");
    },

    onRefreshStats: function () {
      this._loadSystemStats();
      MessageToast.show("System stats refreshed.");
    },

    onExportAuditLogs: function () {
      MessageBox.information("Audit log export is available via the OData endpoint:\n/api/AuditLogs?$format=json");
    },

    // Formatters
    formatDate: function (sDate) {
      if (!sDate) return "";
      try {
        return new Date(sDate).toLocaleString("en-US", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
      } catch (e) { return sDate; }
    },

    formatSuccessState: function (bSuccess) {
      return bSuccess ? "Success" : "Error";
    },

    formatSuccessText: function (bSuccess) {
      return bSuccess ? "Success" : "Failed";
    },

    formatActionIcon: function (sAction) {
      var map = {
        CREATE: "sap-icon://add",
        UPDATE: "sap-icon://edit",
        DELETE: "sap-icon://delete",
        READ  : "sap-icon://show",
        LOGIN : "sap-icon://key",
        LOGOUT: "sap-icon://log"
      };
      return (sAction && map[sAction]) || "sap-icon://activity-items";
    }
  });
});
