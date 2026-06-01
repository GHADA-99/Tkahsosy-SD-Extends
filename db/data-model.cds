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
  employeeId   : String(50);
  employeeName : String(200);
  employeeType : String(100);
  
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
      serviceMaterial : String(50)  not null;
      examNameEn      : String(200) not null;
      examNameAr      : String(200);
      modality        : String(10)  not null;
      price           : Integer     not null;
      transactionDate : DateTime    not null;
      otherNmType     : String(100);
      salesOffice     : String(100);
      cost            : Integer;
      discount        : Integer;
      radiologist     : String(200);
      room            : String(100);
}

entity SalesOrdersV2 : managed {
  key salesOrderId         : String(20)  not null;
      erpSalesOrderId      : String(50);
      accountingDocumentId : String(50);
      serviceMaterial      : String(50);
      month                : String(20);
      status               : String(50)  default 'draft';
      totalAmount          : Integer     default 0;
      items                : Association to many SalesOrderItemsV2 on items.salesOrder = $self;
}

entity SalesOrderItemsV2 : managed {
  key itemId          : String(50)  not null;
      salesOrder      : Association to SalesOrdersV2 not null;
      transactionId   : String(20);
      serviceMaterial : String(50);
      examNameEn      : String(200);
      price           : Integer;
      transactionDate : DateTime;
      discountPct     : Integer     default 0;
      discountedPrice : Integer     default 0;
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
  key itemCode     : String(50);
      group        : Association to ModalityGroups not null;
      serviceTypes : Association to many ModalityServiceTypes on serviceTypes.item = $self;
}

entity ModalityServiceTypes {
  key serviceTypeCode : String(50);
      item            : Association to ModalityGroupItems not null;
      name            : String(200) not null;
      material        : Association to Materials on material.examCode = serviceTypeCode;
}

entity Materials : managed {
  key materialCode   : String(50)    not null;
      descriptionEn  : String(200);
      descriptionAr  : String(200);
      modality       : String(10);
      modalityGroup  : String(100);
      materialGroup1 : String(100);
      naphisCode     : String(50);
      scanType       : String(100);
      examCode       : String(50);
      pricing        : Decimal(15,2);
}
