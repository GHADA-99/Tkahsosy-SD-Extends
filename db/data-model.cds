using { managed, cuid } from '@sap/cds/common';

namespace medsync;

entity Patients : cuid, managed {
  firstName       : String(100) not null;
  lastName        : String(100) not null;
  dateOfBirth     : Date;
  gender          : String(20);
  email           : String(255);
  phone           : String(30);
  street          : String(255);
  city            : String(100);
  state           : String(100);
  zip             : String(20);
  country         : String(100);
  medicalHistory  : LargeString;
  allergies       : String(500);
  isActive        : Boolean default true;
  appointments    : Association to many Appointments on appointments.patient = $self;
  medicalRecords  : Association to many MedicalRecords on medicalRecords.patient = $self;
  doctors         : Association to many DoctorPatient on doctors.patient = $self;
  notifications   : Association to many Notifications on notifications.patient = $self;
}

entity Doctors : cuid, managed {
  firstName       : String(100) not null;
  lastName        : String(100) not null;
  specialization  : String(200);
  licenseNumber   : String(100);
  email           : String(255);
  phone           : String(30);
  department      : String(200);
  availability    : String(500);
  isActive        : Boolean default true;
  patients        : Association to many DoctorPatient on patients.doctor = $self;
  appointments    : Association to many Appointments on appointments.doctor = $self;
  medicalRecords  : Association to many MedicalRecords on medicalRecords.doctor = $self;
}

entity DoctorPatient : cuid, managed {
  patient          : Association to Patients not null;
  doctor           : Association to Doctors not null;
  relationshipType : String(50) default 'primary';
  startDate        : Date;
  endDate          : Date;
  isPrimary        : Boolean default false;
  notes            : String(500);
}

entity Appointments : cuid, managed {
  patient          : Association to Patients not null;
  doctor           : Association to Doctors not null;
  scheduledDate    : DateTime not null;
  duration         : Integer default 30;
  status           : String(50) default 'scheduled';
  appointmentType  : String(50) default 'consultation';
  notes            : String(1000);
  cancelReason     : String(500);
  reminderSent     : Boolean default false;
  isDeleted        : Boolean default false;
}

entity MedicalRecords : cuid, managed {
  patient          : Association to Patients not null;
  doctor           : Association to Doctors not null;
  recordDate       : Date not null;
  diagnosis        : String(1000);
  treatment        : String(1000);
  prescriptions    : LargeString;
  confidentiality  : String(50) default 'normal';
  isDeleted        : Boolean default false;
}

entity Notifications : cuid, managed {
  patient          : Association to Patients;
  doctor           : Association to Doctors;
  title            : String(255) not null;
  message          : LargeString;
  notificationType : String(50) default 'system';
  isRead           : Boolean default false;
  readAt           : DateTime;
  scheduledFor     : DateTime;
  expiresAt        : DateTime;
}

entity AuditLogs : cuid, managed {
  userId           : String(255);
  action           : String(100) not null;
  entity           : String(100) not null;
  entityId         : String(100);
  oldValues        : LargeString;
  newValues        : LargeString;
  ipAddress        : String(50);
  userAgent        : String(500);
  success          : Boolean default true;
  errorMessage     : String(500);
}

entity Transactions : managed {
  key transactionId   : String(20)  not null;
      examCode        : String(50)  not null;
      examNameEn      : String(200) not null;
      examNameAr      : String(200);
      modality        : String(10)  not null;
      price           : Integer     not null;
      transactionDate : DateTime    not null;
}

entity SalesOrders : managed {
  key salesOrderId    : String(20)  not null;
      erpSalesOrderId : String(50);
      examCode        : String(50);
      month           : String(20);
      status          : String(50)  default 'draft';
      totalAmount     : Integer     default 0;
      items           : Association to many SalesOrderItems on items.salesOrder = $self;
}

entity SalesOrderItems : managed {
  key itemId          : String(50)  not null;
      salesOrder      : Association to SalesOrders not null;
      transactionId   : String(20);
      examCode        : String(50);
      examNameEn      : String(200);
      price           : Integer;
      transactionDate : DateTime;
}

entity ModalityGroups : managed {
  key groupCode            : String(50);
      name                 : String(200) not null;
      modality             : String(10)  not null;
      discount             : Integer     default 0;
      qtyOrig              : Integer     default 0;
      qtyUpdated           : Integer     default 0;
      finished             : Boolean     default false;
      firstThreshVol       : Integer     default 0;
      firstThreshDiscount  : Integer     default 0;
      secondThreshVol      : Integer     default 0;
      secondThreshDiscount : Integer     default 0;
      items                : Association to many ModalityGroupItems on items.group = $self;
}

entity ModalityGroupItems {
  key itemCode : String(50);
      group    : Association to ModalityGroups not null;
      examCode : String(50) not null;
}
