using { medsync } from '../db/data-model';

@path: '/api'
service MedSyncService {

  // ─── Patients ────────────────────────────────────────────────────────────────
  @odata.draft.enabled
  @requires: ['patient', 'doctor', 'admin']
  @Capabilities: {
    SearchRestrictions: { Searchable: true, UnsupportedExpressions: #phrase },
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity Patients as projection on medsync.Patients
    actions {
      action deactivatePatient() returns Patients;
      action activatePatient()   returns Patients;
    };

  // ─── Doctors ─────────────────────────────────────────────────────────────────
  @Capabilities: {
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity Doctors as projection on medsync.Doctors;

  // ─── DoctorPatient relationship ──────────────────────────────────────────────
  @requires: ['doctor', 'admin']
  entity DoctorPatient as projection on medsync.DoctorPatient;

  // ─── Appointments ─────────────────────────────────────────────────────────────
  @requires: ['patient', 'doctor', 'admin']
  @Capabilities: {
    SearchRestrictions: { Searchable: true },
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity Appointments as projection on medsync.Appointments
    actions {
      action cancelAppointment(reason: String)      returns Appointments;
      action rescheduleAppointment(
        newDate  : DateTime,
        newDoctor: UUID
      ) returns Appointments;
      action completeAppointment() returns Appointments;
      action markNoShow()          returns Appointments;
    };

  // ─── MedicalRecords ───────────────────────────────────────────────────────────
  @requires: ['doctor', 'admin']
  @Capabilities: {
    SearchRestrictions: { Searchable: true },
    FilterRestrictions: { Filterable: true }
  }
  entity MedicalRecords as projection on medsync.MedicalRecords;

  // ─── Notifications ────────────────────────────────────────────────────────────
  @requires: ['patient', 'doctor', 'admin']
  entity Notifications as projection on medsync.Notifications
    actions {
      action markAsRead()    returns Notifications;
      action markAllAsRead() returns Boolean;
    };

  // ─── AuditLogs ────────────────────────────────────────────────────────────────
  @requires: ['admin']
  @Capabilities: {
    InsertRestrictions: { Insertable: false },
    UpdateRestrictions: { Updatable: false },
    DeleteRestrictions: { Deletable: false }
  }
  entity AuditLogs as projection on medsync.AuditLogs;

  // ─── SalesOrders V2 ───────────────────────────────────────────────────────────
  entity SalesOrdersV2     as projection on medsync.SalesOrdersV2;
  entity SalesOrderItemsV2 as projection on medsync.SalesOrderItemsV2;

  // ─── Transactions ─────────────────────────────────────────────────────────────
  @Capabilities: {
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity Transactions as projection on medsync.Transactions;

  // ─── ModalityGroups ───────────────────────────────────────────────────────────
  @Capabilities: {
    SearchRestrictions: { Searchable: true },
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity ModalityGroups        as projection on medsync.ModalityGroups;
  entity ModalityGroupItems    as projection on medsync.ModalityGroupItems;
  entity ModalityServiceTypes  as projection on medsync.ModalityServiceTypes;

  // ─── Materials ────────────────────────────────────────────────────────────────
  @Capabilities: {
    FilterRestrictions: { Filterable: true },
    SortRestrictions  : { Sortable: true }
  }
  entity Materials as projection on medsync.Materials;

  // ─── Functions ────────────────────────────────────────────────────────────────
  @requires: ['admin']
  function getSystemStats() returns {
    totalPatients       : Integer;
    totalDoctors        : Integer;
    totalAppointments   : Integer;
    todaysAppointments  : Integer;
    pendingNotifications: Integer;
  };

  @requires: ['patient', 'doctor', 'admin']
  function getUnreadNotificationCount(userId: String) returns Integer;

  @requires: ['doctor', 'admin']
  function getDoctorAvailability(
    doctorId: UUID,
    date    : Date
  ) returns array of {
    startTime: DateTime;
    endTime  : DateTime;
    available: Boolean;
  };

  @requires: ['patient', 'doctor', 'admin']
  function searchPatients(query: String) returns array of Patients;

  // Cleanup action
  @requires: ['admin']
  action cleanupOldNotifications() returns { deleted: Integer };

  // S/4HANA SOAP proxy – posts a fixed Journal Entry to the cloud tenant
  action postAccountingDocument() returns { success: Boolean; message: String; accountingDocumentId: String };
}
