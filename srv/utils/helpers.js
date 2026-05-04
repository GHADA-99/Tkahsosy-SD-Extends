'use strict';

const { NOTIFICATION_TYPE, AUDIT_ACTIONS } = require('./constants');

/**
 * Formats a date value into a locale-aware string.
 * @param {string|Date} date
 * @param {string} [locale='en-US']
 * @param {object} [options]
 * @returns {string}
 */
function formatDate(date, locale = 'en-US', options = {}) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const defaultOptions = {
      year : 'numeric',
      month: 'short',
      day  : 'numeric',
      ...options
    };
    return d.toLocaleDateString(locale, defaultOptions);
  } catch {
    return String(date);
  }
}

/**
 * Formats a DateTime value into a locale-aware string including time.
 * @param {string|Date} date
 * @param {string} [locale='en-US']
 * @returns {string}
 */
function formatDateTime(date, locale = 'en-US') {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleString(locale, {
      year  : 'numeric',
      month : 'short',
      day   : 'numeric',
      hour  : '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(date);
  }
}

/**
 * Builds a notification object ready to be inserted into the Notifications entity.
 * @param {string|null} patientId
 * @param {string|null} doctorId
 * @param {string} title
 * @param {string} message
 * @param {string} [type]
 * @param {Date|null}  [scheduledFor]
 * @param {Date|null}  [expiresAt]
 * @returns {object}
 */
function generateNotification(patientId, doctorId, title, message, type = NOTIFICATION_TYPE.SYSTEM, scheduledFor = null, expiresAt = null) {
  const notification = {
    title,
    message,
    notificationType: type,
    isRead          : false
  };
  if (patientId) notification.patient_ID  = patientId;
  if (doctorId)  notification.doctor_ID   = doctorId;
  if (scheduledFor) notification.scheduledFor = scheduledFor;
  if (expiresAt)    notification.expiresAt    = expiresAt;
  return notification;
}

/**
 * Builds an audit log entry object ready to be inserted.
 * @param {string} userId
 * @param {string} action
 * @param {string} entity
 * @param {string} entityId
 * @param {object|null} oldValues
 * @param {object|null} newValues
 * @param {string} [ipAddress]
 * @param {string} [userAgent]
 * @returns {object}
 */
function generateAuditLog(userId, action, entity, entityId, oldValues = null, newValues = null, ipAddress = '', userAgent = '') {
  return {
    userId,
    action,
    entity,
    entityId,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
    ipAddress,
    userAgent,
    success: true
  };
}

/**
 * Returns an array of time-slot objects for a given date.
 * Each slot spans `duration` minutes; clinic hours are 08:00–18:00.
 * @param {string|Date} date
 * @param {number} [duration=30]  minutes per slot
 * @returns {Array<{ startTime: Date, endTime: Date }>}
 */
function getTimeSlots(date, duration = 30) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return [];

  const slots = [];
  const start = new Date(d);
  start.setHours(8, 0, 0, 0);

  const end = new Date(d);
  end.setHours(18, 0, 0, 0);

  let current = new Date(start);
  while (current < end) {
    const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
    if (slotEnd > end) break;
    slots.push({ startTime: new Date(current), endTime: new Date(slotEnd) });
    current = slotEnd;
  }
  return slots;
}

/**
 * Checks whether two time ranges overlap.
 * @param {Date} start1
 * @param {Date} end1
 * @param {Date} start2
 * @param {Date} end2
 * @returns {boolean}
 */
function timeSlotsOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * Strips sensitive fields from a medical record for non-privileged views.
 * @param {object} record
 * @returns {object}
 */
function sanitizeMedicalRecord(record) {
  if (!record) return record;
  const { prescriptions, ...safe } = record; // eslint-disable-line no-unused-vars
  return safe;
}

/**
 * Deep-clones a plain object (no functions/class instances).
 * @param {object} obj
 * @returns {object}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculates the end DateTime of an appointment given its start and duration.
 * @param {string|Date} startDate
 * @param {number} durationMinutes
 * @returns {Date}
 */
function getAppointmentEndTime(startDate, durationMinutes) {
  const d = new Date(startDate);
  return new Date(d.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Returns a reminder DateTime (24 hours before the appointment).
 * @param {string|Date} appointmentDate
 * @returns {Date}
 */
function getReminderTime(appointmentDate) {
  const d = new Date(appointmentDate);
  return new Date(d.getTime() - 24 * 60 * 60 * 1000);
}

module.exports = {
  formatDate,
  formatDateTime,
  generateNotification,
  generateAuditLog,
  getTimeSlots,
  timeSlotsOverlap,
  sanitizeMedicalRecord,
  deepClone,
  getAppointmentEndTime,
  getReminderTime
};
