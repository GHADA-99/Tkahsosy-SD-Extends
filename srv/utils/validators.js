'use strict';

const { APPOINTMENT_STATUS } = require('./constants');

/**
 * Validates an email address format.
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: `Invalid email format: ${email}` };
  }
  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or fewer' };
  }
  return { valid: true };
}

/**
 * Validates a phone number (international formats accepted).
 * @param {string} phone
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }
  const cleaned = phone.replace(/[\s\-().+]/g, '');
  if (!/^\d{7,15}$/.test(cleaned)) {
    return { valid: false, error: `Invalid phone number: ${phone}. Must contain 7-15 digits.` };
  }
  return { valid: true };
}

/**
 * Validates a date string.
 * @param {string|Date} date
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDate(date) {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return { valid: false, error: `Invalid date: ${date}` };
  }
  return { valid: true, date: d };
}

/**
 * Validates appointment scheduling constraints.
 * @param {string|Date} scheduledDate
 * @param {number} duration  minutes
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAppointmentTime(scheduledDate, duration) {
  const dateResult = validateDate(scheduledDate);
  if (!dateResult.valid) return dateResult;

  const apptDate = dateResult.date;
  const now = new Date();

  if (apptDate <= now) {
    return { valid: false, error: 'Appointment must be scheduled in the future' };
  }

  // Appointments must be at least 15 minutes from now
  const minAdvance = new Date(now.getTime() + 15 * 60 * 1000);
  if (apptDate < minAdvance) {
    return { valid: false, error: 'Appointment must be scheduled at least 15 minutes from now' };
  }

  // No appointments more than 1 year in advance
  const maxAdvance = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (apptDate > maxAdvance) {
    return { valid: false, error: 'Appointment cannot be scheduled more than 1 year in advance' };
  }

  if (!Number.isInteger(duration) || duration < 15) {
    return { valid: false, error: 'Duration must be a positive integer of at least 15 minutes' };
  }
  if (duration > 480) {
    return { valid: false, error: 'Duration cannot exceed 480 minutes (8 hours)' };
  }

  // Check business hours (8 AM – 6 PM)
  const hour = apptDate.getHours();
  if (hour < 8 || hour >= 18) {
    return { valid: false, error: 'Appointments must be scheduled between 08:00 and 18:00' };
  }

  // No Sunday appointments
  if (apptDate.getDay() === 0) {
    return { valid: false, error: 'Appointments cannot be scheduled on Sundays' };
  }

  return { valid: true };
}

/**
 * Validates a medical license number.
 * License format: 2-3 uppercase letters followed by 5-9 digits, e.g. MD123456
 * @param {string} license
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLicenseNumber(license) {
  if (!license || typeof license !== 'string') {
    return { valid: false, error: 'License number is required' };
  }
  const trimmed = license.trim().toUpperCase();
  const licenseRegex = /^[A-Z]{2,3}\d{5,9}$/;
  if (!licenseRegex.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid license number: ${license}. Expected format: 2-3 letters followed by 5-9 digits (e.g. MD123456)`
    };
  }
  return { valid: true };
}

/**
 * Validates a name field (first or last).
 * @param {string} name
 * @param {string} fieldLabel
 * @returns {{ valid: boolean, error?: string }}
 */
function validateName(name, fieldLabel = 'Name') {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: `${fieldLabel} is required` };
  }
  if (name.trim().length > 100) {
    return { valid: false, error: `${fieldLabel} must be 100 characters or fewer` };
  }
  if (!/^[a-zA-ZÀ-ÿ'\-\s]+$/.test(name.trim())) {
    return { valid: false, error: `${fieldLabel} contains invalid characters` };
  }
  return { valid: true };
}

/**
 * Validates an appointment status transition.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {{ valid: boolean, error?: string }}
 */
function validateStatusTransition(currentStatus, newStatus) {
  const allowedTransitions = {
    [APPOINTMENT_STATUS.SCHEDULED]  : [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.RESCHEDULED],
    [APPOINTMENT_STATUS.IN_PROGRESS]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW],
    [APPOINTMENT_STATUS.RESCHEDULED]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.IN_PROGRESS],
    [APPOINTMENT_STATUS.COMPLETED]  : [],
    [APPOINTMENT_STATUS.CANCELLED]  : [],
    [APPOINTMENT_STATUS.NO_SHOW]    : []
  };

  const allowed = allowedTransitions[currentStatus];
  if (allowed === undefined) {
    return { valid: false, error: `Unknown current status: ${currentStatus}` };
  }
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`
    };
  }
  return { valid: true };
}

module.exports = {
  validateEmail,
  validatePhone,
  validateDate,
  validateAppointmentTime,
  validateLicenseNumber,
  validateName,
  validateStatusTransition
};
