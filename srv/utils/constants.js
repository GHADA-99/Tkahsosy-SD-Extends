'use strict';

const APPOINTMENT_STATUS = {
  SCHEDULED  : 'scheduled',
  COMPLETED  : 'completed',
  CANCELLED  : 'cancelled',
  NO_SHOW    : 'no-show',
  RESCHEDULED: 'rescheduled',
  IN_PROGRESS: 'in-progress'
};

const APPOINTMENT_TYPE = {
  CONSULTATION: 'consultation',
  FOLLOW_UP   : 'follow-up',
  SURGERY     : 'surgery',
  EMERGENCY   : 'emergency',
  CHECKUP     : 'checkup',
  LAB_REVIEW  : 'lab-review',
  TELEMEDICINE: 'telemedicine'
};

const NOTIFICATION_TYPE = {
  APPOINTMENT: 'appointment',
  ALERT      : 'alert',
  REMINDER   : 'reminder',
  SYSTEM     : 'system',
  MESSAGE    : 'message',
  RESULT     : 'result'
};

const USER_TYPE = {
  PATIENT: 'patient',
  DOCTOR : 'doctor',
  ADMIN  : 'admin'
};

const RELATIONSHIP_TYPE = {
  PRIMARY   : 'primary',
  SPECIALIST: 'specialist',
  REFERRING : 'referring',
  EMERGENCY : 'emergency',
  CONSULTANT: 'consultant'
};

const CONFIDENTIALITY_LEVEL = {
  NORMAL      : 'normal',
  CONFIDENTIAL: 'confidential',
  RESTRICTED  : 'restricted',
  TOP_SECRET  : 'top-secret'
};

const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  READ  : 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN : 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT'
};

const GENDER = {
  MALE       : 'male',
  FEMALE     : 'female',
  OTHER      : 'other',
  UNSPECIFIED: 'unspecified'
};

const APPOINTMENT_DURATION = {
  SHORT   : 15,
  STANDARD: 30,
  LONG    : 60,
  EXTENDED: 90
};

module.exports = {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  NOTIFICATION_TYPE,
  USER_TYPE,
  RELATIONSHIP_TYPE,
  CONFIDENTIALITY_LEVEL,
  AUDIT_ACTIONS,
  GENDER,
  APPOINTMENT_DURATION
};
