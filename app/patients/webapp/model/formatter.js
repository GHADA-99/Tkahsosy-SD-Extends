sap.ui.define([], function () {
  "use strict";

  return {

    formatDate: function (sDate) {
      if (!sDate) return "";
      try {
        var oDate = new Date(sDate);
        if (isNaN(oDate.getTime())) return sDate;
        return oDate.toLocaleDateString("en-US", {
          year : "numeric",
          month: "short",
          day  : "numeric"
        });
      } catch (e) {
        return sDate;
      }
    },

    formatDateTime: function (sDate) {
      if (!sDate) return "";
      try {
        var oDate = new Date(sDate);
        if (isNaN(oDate.getTime())) return sDate;
        return oDate.toLocaleString("en-US", {
          year  : "numeric",
          month : "short",
          day   : "numeric",
          hour  : "2-digit",
          minute: "2-digit"
        });
      } catch (e) {
        return sDate;
      }
    },

    formatGender: function (sGender) {
      if (!sGender) return "";
      var map = {
        male       : "Male",
        female     : "Female",
        other      : "Other",
        unspecified: "Unspecified"
      };
      return map[sGender.toLowerCase()] || sGender;
    },

    formatAppointmentStatus: function (sStatus) {
      if (!sStatus) return "";
      var map = {
        scheduled  : "Scheduled",
        completed  : "Completed",
        cancelled  : "Cancelled",
        "no-show"  : "No Show",
        rescheduled: "Rescheduled",
        "in-progress": "In Progress"
      };
      return map[sStatus.toLowerCase()] || sStatus;
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
      return (sStatus && map[sStatus.toLowerCase()]) || "None";
    },

    formatBooleanIcon: function (bValue) {
      return bValue ? "sap-icon://accept" : "sap-icon://decline";
    },

    formatActiveState: function (bActive) {
      return bActive ? "Success" : "Error";
    },

    formatActiveText: function (bActive) {
      return bActive ? "Active" : "Inactive";
    }
  };
});
