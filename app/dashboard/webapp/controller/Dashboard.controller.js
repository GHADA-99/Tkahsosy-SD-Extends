sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("medsync.dashboard.controller.Dashboard", {

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oModel  = this.getOwnerComponent().getModel();
      this._oStats  = this.getOwnerComponent().getModel("stats");

      this.getView().setModel(this._oStats, "stats");

      this._oRouter.getRoute("Dashboard").attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function () {
      this._loadStats();
      this._loadTodaysAppointments();
      this._loadRecentNotifications();
    },

    _loadStats: async function () {
      try {
        var oModel = this._oModel;

        // Fetch counts in parallel
        var aRequests = [
          fetch("/api/Patients?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Doctors?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Appointments?$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Notifications?$filter=isRead eq false&$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Appointments?$filter=status eq 'completed'&$count=true&$top=0").then(function (r) { return r.json(); }),
          fetch("/api/Appointments?$filter=status eq 'cancelled'&$count=true&$top=0").then(function (r) { return r.json(); })
        ];

        // Today's appointments
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        var sTodayFilter = "scheduledDate ge " + today.toISOString() + " and scheduledDate lt " + tomorrow.toISOString();
        aRequests.push(
          fetch("/api/Appointments?$filter=" + encodeURIComponent(sTodayFilter) + "&$count=true&$top=0")
            .then(function (r) { return r.json(); })
        );

        var results = await Promise.all(aRequests);

        this._oStats.setData({
          totalPatients        : results[0]["@odata.count"] || 0,
          totalDoctors         : results[1]["@odata.count"] || 0,
          totalAppointments    : results[2]["@odata.count"] || 0,
          pendingNotifications : results[3]["@odata.count"] || 0,
          completedAppointments: results[4]["@odata.count"] || 0,
          cancelledAppointments: results[5]["@odata.count"] || 0,
          todaysAppointments   : results[6]["@odata.count"] || 0,
          lastRefresh          : new Date().toLocaleTimeString()
        });

        // Compute derived KPIs for progress bars
        var total = Number(results[2]["@odata.count"] || 1);
        var completed = Number(results[4]["@odata.count"] || 0);
        this._oStats.setProperty("/completionRate", Math.round((completed / total) * 100));

      } catch (err) {
        console.warn("Dashboard stat load failed:", err.message);
      }
    },

    _loadTodaysAppointments: function () {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      var oTable   = this.byId("todaysApptTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (oBinding) oBinding.refresh();
    },

    _loadRecentNotifications: function () {
      var oList    = this.byId("notificationsList");
      var oBinding = oList && oList.getBinding("items");
      if (oBinding) oBinding.refresh();
    },

    onRefresh: function () {
      this._loadStats();
      this._loadTodaysAppointments();
      this._loadRecentNotifications();
      MessageToast.show("Dashboard refreshed.");
    },

    onNavToPatients: function () {
      window.location.href = "/app/patients/webapp/index.html";
    },

    onNavToAppointments: function () {
      window.location.href = "/app/appointments/webapp/index.html";
    },

    onNavToAdmin: function () {
      window.location.href = "/app/admin/webapp/index.html";
    },

    // Formatter helpers
    formatDate: function (sDate) {
      if (!sDate) return "";
      try {
        return new Date(sDate).toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
      } catch (e) { return sDate; }
    },

    formatStatusState: function (sStatus) {
      var map = {
        scheduled    : "Information",
        completed    : "Success",
        cancelled    : "Error",
        "no-show"    : "Warning",
        rescheduled  : "Warning"
      };
      return (sStatus && map[sStatus]) || "None";
    },

    formatProgressColor: function (iValue) {
      if (iValue >= 80) return "Good";
      if (iValue >= 50) return "Critical";
      return "Bad";
    }
  });
});
