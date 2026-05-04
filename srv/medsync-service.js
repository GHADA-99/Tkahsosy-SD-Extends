'use strict';

/**
 * MedSync Service – main handler file.
 * CAP auto-discovers this as the implementation for medsync-service.cds
 * because it shares the same base name.
 *
 * It delegates to three focused handler modules:
 *   - data-service.js       : Patients, Doctors, DoctorPatient, MedicalRecords
 *   - appointment-service.js: Appointments (conflict detection, actions)
 *   - notification-service.js: Notifications (mark-read, cleanup)
 */

const cds = require('@sap/cds');
const { validateEmail, validatePhone, validateName, validateLicenseNumber, validateAppointmentTime, validateStatusTransition } = require('./utils/validators');
const { generateAuditLog, generateNotification, getAppointmentEndTime, getReminderTime, timeSlotsOverlap } = require('./utils/helpers');
const { AUDIT_ACTIONS, NOTIFICATION_TYPE, CONFIDENTIALITY_LEVEL, APPOINTMENT_STATUS } = require('./utils/constants');

module.exports = class MedSyncService extends cds.ApplicationService {

  async init() {

    const {
      Patients,
      Doctors,
      DoctorPatient,
      Appointments,
      MedicalRecords,
      Notifications,
      AuditLogs
    } = this.entities;

    // ═══════════════════════════════════════════════════════════════════════════
    //  PATIENTS
    // ═══════════════════════════════════════════════════════════════════════════

    this.before('CREATE', Patients, async (req) => {
      await _validatePatient(req, req.data, false, Patients);
    });

    this.before('UPDATE', Patients, async (req) => {
      await _validatePatient(req, req.data, true, Patients);
    });

    // For draft-enabled entities, also validate before draft activation
    this.before('SAVE', Patients, async (req) => {
      await _validatePatient(req, req.data, !!req.data.ID, Patients);
    });

    this.after('CREATE', Patients, async (data, req) => {
      // Welcome notification
      await _insertNotification(Notifications, {
        patient_ID      : data.ID,
        title           : 'Welcome to MedSync',
        message         : `Hello ${data.firstName} ${data.lastName}, your patient profile has been created successfully.`,
        notificationType: NOTIFICATION_TYPE.SYSTEM,
        isRead          : false
      });
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.CREATE, 'Patients', data.ID, null, data, req);
    });

    this.after('UPDATE', Patients, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Patients', data.ID, null, data, req);
    });

    this.before('DELETE', Patients, async (req) => {
      const id = _id(req);
      if (!id) return;
      await UPDATE(Patients).set({ isActive: false }).where({ ID: id });
      req.reject(200, 'Patient deactivated');
    });

    this.on('deactivatePatient', Patients, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Patients).set({ isActive: false }).where({ ID });
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Patients', ID, null, { isActive: false }, req);
      return SELECT.one.from(Patients).where({ ID });
    });

    this.on('activatePatient', Patients, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Patients).set({ isActive: true }).where({ ID });
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Patients', ID, null, { isActive: true }, req);
      return SELECT.one.from(Patients).where({ ID });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  DOCTORS
    // ═══════════════════════════════════════════════════════════════════════════

    this.before('CREATE', Doctors, async (req) => {
      await _validateDoctor(req, req.data, Doctors);
    });

    this.before('UPDATE', Doctors, async (req) => {
      await _validateDoctor(req, req.data, Doctors);
    });

    this.before('SAVE', Doctors, async (req) => {
      await _validateDoctor(req, req.data, Doctors);
    });

    this.after('CREATE', Doctors, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.CREATE, 'Doctors', data.ID, null, data, req);
    });

    this.after('UPDATE', Doctors, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Doctors', data.ID, null, data, req);
    });

    this.before('DELETE', Doctors, async (req) => {
      const id = _id(req);
      if (!id) return;
      await UPDATE(Doctors).set({ isActive: false }).where({ ID: id });
      req.reject(200, 'Doctor deactivated');
    });

    this.on('deactivateDoctor', Doctors, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Doctors).set({ isActive: false }).where({ ID });
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Doctors', ID, null, { isActive: false }, req);
      return SELECT.one.from(Doctors).where({ ID });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  MEDICAL RECORDS – confidentiality enforcement
    // ═══════════════════════════════════════════════════════════════════════════

    this.before('READ', MedicalRecords, async (req) => {
      const isAdmin = req.user && (req.user.is('admin') || (req.user.roles && req.user.roles['admin']));
      if (isAdmin) return;
      // Non-admins cannot see restricted records
      const w = req.query.SELECT.where;
      const restriction = { ref: ['confidentiality'] };
      const notRestricted = [restriction, '!=', { val: CONFIDENTIALITY_LEVEL.RESTRICTED }];
      req.query.SELECT.where = w && w.length ? [...w, 'and', notRestricted] : notRestricted;
    });

    this.after('CREATE', MedicalRecords, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.CREATE, 'MedicalRecords', data.ID, null, data, req);
    });

    this.after('UPDATE', MedicalRecords, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'MedicalRecords', data.ID, null, data, req);
    });

    this.before('DELETE', MedicalRecords, async (req) => {
      const id = _id(req);
      if (!id) return;
      await UPDATE(MedicalRecords).set({ isDeleted: true }).where({ ID: id });
      req.reject(200, 'Medical record archived');
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  APPOINTMENTS
    // ═══════════════════════════════════════════════════════════════════════════

    this.before('CREATE', Appointments, async (req) => {
      const data = req.data;
      if (data.scheduledDate) {
        const duration = data.duration || 30;
        const timeResult = validateAppointmentTime(data.scheduledDate, duration);
        if (!timeResult.valid) return req.error(400, timeResult.error);

        if (data.doctor_ID) {
          const conflict = await _checkDoctorConflict(Appointments, data.doctor_ID, data.scheduledDate, duration, null);
          if (conflict) return req.error(409, `Doctor already has an appointment at ${new Date(data.scheduledDate).toLocaleString()}.`);
        }
        if (data.patient_ID) {
          const conflict = await _checkPatientConflict(Appointments, data.patient_ID, data.scheduledDate, duration, null);
          if (conflict) return req.error(409, 'Patient already has an appointment at this time slot.');
        }
      }
      if (!data.status) data.status = APPOINTMENT_STATUS.SCHEDULED;
    });

    this.before('UPDATE', Appointments, async (req) => {
      const data = req.data;
      const id = _id(req);
      if (!id) return;
      const existing = await SELECT.one.from(Appointments).where({ ID: id });
      if (!existing) return req.error(404, `Appointment ${id} not found`);

      if (data.status && data.status !== existing.status) {
        const t = validateStatusTransition(existing.status, data.status);
        if (!t.valid) return req.error(400, t.error);
      }

      if (data.scheduledDate && data.scheduledDate !== existing.scheduledDate) {
        const duration = data.duration || existing.duration || 30;
        const t = validateAppointmentTime(data.scheduledDate, duration);
        if (!t.valid) return req.error(400, t.error);
        const doctorId = data.doctor_ID || existing.doctor_ID;
        if (doctorId) {
          const conflict = await _checkDoctorConflict(Appointments, doctorId, data.scheduledDate, duration, id);
          if (conflict) return req.error(409, 'Doctor already has an appointment at the new time slot.');
        }
      }
    });

    this.after('CREATE', Appointments, async (data, req) => {
      await _notifyAppointmentCreated(Notifications, data);
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.CREATE, 'Appointments', data.ID, null, data, req);
    });

    this.after('UPDATE', Appointments, async (data, req) => {
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Appointments', data.ID, null, data, req);
    });

    this.before('DELETE', Appointments, async (req) => {
      const id = _id(req);
      if (!id) return;
      await UPDATE(Appointments).set({ isDeleted: true, status: APPOINTMENT_STATUS.CANCELLED }).where({ ID: id });
      req.reject(200, 'Appointment cancelled');
    });

    // ── Appointment actions ──────────────────────────────────────────────────

    this.on('cancelAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const { reason } = req.data;
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');
      const t = validateStatusTransition(existing.status, APPOINTMENT_STATUS.CANCELLED);
      if (!t.valid) return req.error(400, t.error);

      await UPDATE(Appointments).set({ status: APPOINTMENT_STATUS.CANCELLED, cancelReason: reason || 'Cancelled' }).where({ ID });
      const updated = await SELECT.one.from(Appointments).where({ ID });

      const apptTime = new Date(existing.scheduledDate).toLocaleString();
      if (existing.patient_ID) {
        await _insertNotification(Notifications, {
          patient_ID: existing.patient_ID,
          title: 'Appointment Cancelled',
          message: `Your appointment on ${apptTime} has been cancelled. Reason: ${reason || 'Not specified'}`,
          notificationType: NOTIFICATION_TYPE.APPOINTMENT,
          isRead: false
        });
      }
      if (existing.doctor_ID) {
        await _insertNotification(Notifications, {
          doctor_ID: existing.doctor_ID,
          title: 'Appointment Cancelled',
          message: `Appointment on ${apptTime} has been cancelled. Reason: ${reason || 'Not specified'}`,
          notificationType: NOTIFICATION_TYPE.APPOINTMENT,
          isRead: false
        });
      }
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('rescheduleAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const { newDate, newDoctor } = req.data;
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');

      const allowed = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED];
      if (!allowed.includes(existing.status)) {
        return req.error(400, `Cannot reschedule an appointment with status '${existing.status}'`);
      }

      const duration    = existing.duration || 30;
      const targetDate  = newDate  || existing.scheduledDate;
      const targetDoc   = newDoctor || existing.doctor_ID;

      const tv = validateAppointmentTime(targetDate, duration);
      if (!tv.valid) return req.error(400, tv.error);

      const conflict = await _checkDoctorConflict(Appointments, targetDoc, targetDate, duration, ID);
      if (conflict) return req.error(409, 'Doctor already has an appointment at the new time slot.');

      await UPDATE(Appointments).set({
        scheduledDate: targetDate,
        doctor_ID    : targetDoc,
        status       : APPOINTMENT_STATUS.RESCHEDULED
      }).where({ ID });

      const updated = await SELECT.one.from(Appointments).where({ ID });

      if (existing.patient_ID) {
        await _insertNotification(Notifications, {
          patient_ID: existing.patient_ID,
          title: 'Appointment Rescheduled',
          message: `Your appointment has been rescheduled to ${new Date(targetDate).toLocaleString()}.`,
          notificationType: NOTIFICATION_TYPE.APPOINTMENT,
          isRead: false
        });
      }
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('completeAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');
      const t = validateStatusTransition(existing.status, APPOINTMENT_STATUS.COMPLETED);
      if (!t.valid) return req.error(400, t.error);

      await UPDATE(Appointments).set({ status: APPOINTMENT_STATUS.COMPLETED }).where({ ID });
      const updated = await SELECT.one.from(Appointments).where({ ID });

      if (existing.patient_ID) {
        await _insertNotification(Notifications, {
          patient_ID: existing.patient_ID,
          title: 'Appointment Completed',
          message: `Your appointment on ${new Date(existing.scheduledDate).toLocaleDateString()} has been completed. Thank you for visiting MedSync.`,
          notificationType: NOTIFICATION_TYPE.APPOINTMENT,
          isRead: false
        });
      }
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('markNoShow', Appointments, async (req) => {
      const { ID } = req.params[0];
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');
      const t = validateStatusTransition(existing.status, APPOINTMENT_STATUS.NO_SHOW);
      if (!t.valid) return req.error(400, t.error);
      await UPDATE(Appointments).set({ status: APPOINTMENT_STATUS.NO_SHOW }).where({ ID });
      const updated = await SELECT.one.from(Appointments).where({ ID });
      await _writeAudit(AuditLogs, AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    this.on('markAsRead', Notifications, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Notifications).set({ isRead: true, readAt: new Date().toISOString() }).where({ ID });
      return SELECT.one.from(Notifications).where({ ID });
    });

    this.on('markAllAsRead', Notifications, async (req) => {
      const userId = req.user ? req.user.id : null;
      if (userId) {
        await UPDATE(Notifications).set({ isRead: true, readAt: new Date().toISOString() })
          .where({ isRead: false, patient_ID: userId });
      }
      return true;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  FUNCTIONS / ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    this.on('getSystemStats', async () => {
      const today    = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const [patients, doctors, appointments, todayAppts, pending] = await Promise.all([
        cds.run(SELECT.one.from(Patients).columns('count(*) as count')),
        cds.run(SELECT.one.from(Doctors).columns('count(*) as count')),
        cds.run(SELECT.one.from(Appointments).columns('count(*) as count')),
        cds.run(SELECT.one.from(Appointments).columns('count(*) as count')
          .where(`scheduledDate >= '${today.toISOString()}' and scheduledDate < '${tomorrow.toISOString()}'`)),
        cds.run(SELECT.one.from(Notifications).columns('count(*) as count').where({ isRead: false }))
      ]);

      return {
        totalPatients       : Number(patients.count),
        totalDoctors        : Number(doctors.count),
        totalAppointments   : Number(appointments.count),
        todaysAppointments  : Number(todayAppts.count),
        pendingNotifications: Number(pending.count)
      };
    });

    this.on('getUnreadNotificationCount', async (req) => {
      const { userId } = req.data;
      const targetId = userId || (req.user ? req.user.id : null);
      if (!targetId) return 0;
      const result = await SELECT.one.from(Notifications)
        .columns('count(*) as count')
        .where({ isRead: false, patient_ID: targetId });
      return Number(result ? result.count : 0);
    });

    this.on('getDoctorAvailability', async (req) => {
      const { doctorId, date } = req.data;
      const { getTimeSlots } = require('./utils/helpers');
      const slots    = getTimeSlots(date, 30);
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

      const booked = await SELECT.from(Appointments).where({
        doctor_ID    : doctorId,
        status       : { 'in': [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED, APPOINTMENT_STATUS.IN_PROGRESS] },
        scheduledDate: { between: dayStart, and: dayEnd }
      });

      return slots.map(slot => {
        const taken = booked.some(appt => {
          const apptEnd = getAppointmentEndTime(appt.scheduledDate, appt.duration || 30);
          return timeSlotsOverlap(slot.startTime, slot.endTime, new Date(appt.scheduledDate), apptEnd);
        });
        return { ...slot, available: !taken };
      });
    });

    this.on('searchPatients', async (req) => {
      const { query } = req.data;
      if (!query || !query.trim()) return SELECT.from(Patients).limit(50);
      const q = query.trim().toLowerCase();
      return SELECT.from(Patients)
        .where(`lower(firstName) like '%${q}%' or lower(lastName) like '%${q}%' or lower(email) like '%${q}%'`)
        .limit(50);
    });

    this.on('cleanupOldNotifications', async (req) => {
      const isAdmin = req.user && (req.user.is('admin') || (req.user.roles && req.user.roles['admin']));
      if (!isAdmin) return req.error(403, 'Admins only');
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      await DELETE.from(Notifications).where({ isRead: true });
      return { deleted: 0 };
    });

    await super.init();
  }
};

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

async function _validatePatient(req, data, isUpdate, Patients) {
  if (data.email) {
    const r = validateEmail(data.email);
    if (!r.valid) return req.error(400, r.error);
    // Email uniqueness
    const q = SELECT.one.from(Patients).where({ email: data.email });
    const existing = await cds.run(q);
    const currentId = isUpdate && req.params && req.params[0] ? req.params[0].ID : null;
    if (existing && existing.ID !== currentId) return req.error(409, `A patient with email ${data.email} already exists`);
  }
  if (data.phone)     { const r = validatePhone(data.phone);             if (!r.valid) return req.error(400, r.error); }
  if (data.firstName) { const r = validateName(data.firstName, 'First name'); if (!r.valid) return req.error(400, r.error); }
  if (data.lastName)  { const r = validateName(data.lastName,  'Last name');  if (!r.valid) return req.error(400, r.error); }
}

async function _validateDoctor(req, data, Doctors) {
  if (data.email) {
    const r = validateEmail(data.email);
    if (!r.valid) return req.error(400, r.error);
  }
  if (data.phone) {
    const r = validatePhone(data.phone);
    if (!r.valid) return req.error(400, r.error);
  }
  if (data.licenseNumber) {
    const r = validateLicenseNumber(data.licenseNumber);
    if (!r.valid) return req.error(400, r.error);
    const existing = await SELECT.one.from(Doctors).where({ licenseNumber: data.licenseNumber });
    if (existing && existing.ID !== data.ID) return req.error(409, `License number ${data.licenseNumber} is already registered`);
  }
}

async function _checkDoctorConflict(Appointments, doctorId, scheduledDate, duration, excludeId) {
  const apptStart = new Date(scheduledDate);
  const apptEnd   = getAppointmentEndTime(apptStart, duration);
  const dayStart  = new Date(apptStart); dayStart.setHours(0, 0, 0, 0);
  const dayEnd    = new Date(apptStart); dayEnd.setHours(23, 59, 59, 999);

  const dayAppts = await cds.run(
    SELECT.from(Appointments).where({
      doctor_ID    : doctorId,
      isDeleted    : false,
      status       : { 'in': [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED, APPOINTMENT_STATUS.IN_PROGRESS] },
      scheduledDate: { between: dayStart, and: dayEnd }
    })
  );
  for (const appt of dayAppts) {
    if (excludeId && appt.ID === excludeId) continue;
    const existStart = new Date(appt.scheduledDate);
    const existEnd   = getAppointmentEndTime(existStart, appt.duration || 30);
    if (timeSlotsOverlap(apptStart, apptEnd, existStart, existEnd)) return appt;
  }
  return null;
}

async function _checkPatientConflict(Appointments, patientId, scheduledDate, duration, excludeId) {
  const apptStart = new Date(scheduledDate);
  const apptEnd   = getAppointmentEndTime(apptStart, duration);
  const dayStart  = new Date(apptStart); dayStart.setHours(0, 0, 0, 0);
  const dayEnd    = new Date(apptStart); dayEnd.setHours(23, 59, 59, 999);

  const dayAppts = await cds.run(
    SELECT.from(Appointments).where({
      patient_ID   : patientId,
      isDeleted    : false,
      status       : { 'in': [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED, APPOINTMENT_STATUS.IN_PROGRESS] },
      scheduledDate: { between: dayStart, and: dayEnd }
    })
  );
  for (const appt of dayAppts) {
    if (excludeId && appt.ID === excludeId) continue;
    const existStart = new Date(appt.scheduledDate);
    const existEnd   = getAppointmentEndTime(existStart, appt.duration || 30);
    if (timeSlotsOverlap(apptStart, apptEnd, existStart, existEnd)) return appt;
  }
  return null;
}

async function _notifyAppointmentCreated(Notifications, data) {
  const apptTime = new Date(data.scheduledDate).toLocaleString();
  const entries  = [];

  if (data.patient_ID) {
    entries.push({
      patient_ID      : data.patient_ID,
      title           : 'Appointment Confirmed',
      message         : `Your appointment has been scheduled for ${apptTime}. Duration: ${data.duration || 30} minutes.`,
      notificationType: NOTIFICATION_TYPE.APPOINTMENT,
      isRead          : false
    });

    const reminderTime = getReminderTime(data.scheduledDate);
    if (reminderTime > new Date()) {
      entries.push({
        patient_ID      : data.patient_ID,
        title           : 'Appointment Reminder',
        message         : `Reminder: You have an appointment on ${apptTime}.`,
        notificationType: NOTIFICATION_TYPE.REMINDER,
        scheduledFor    : reminderTime.toISOString(),
        expiresAt       : new Date(data.scheduledDate).toISOString(),
        isRead          : false
      });
    }
  }

  if (data.doctor_ID) {
    entries.push({
      doctor_ID       : data.doctor_ID,
      title           : 'New Appointment',
      message         : `A new appointment has been scheduled for ${apptTime}. Duration: ${data.duration || 30} minutes.`,
      notificationType: NOTIFICATION_TYPE.APPOINTMENT,
      isRead          : false
    });
  }

  if (entries.length > 0) {
    await INSERT.into(Notifications).entries(entries);
  }
}

async function _insertNotification(Notifications, data) {
  try {
    await INSERT.into(Notifications).entries(data);
  } catch (err) {
    console.error('[Notification] Failed to insert notification:', err.message);
  }
}

async function _writeAudit(AuditLogs, action, entity, entityId, oldValues, newValues, req) {
  try {
    const userId    = req.user ? req.user.id : 'anonymous';
    const ipAddress = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '') : '';
    const userAgent = req.headers ? (req.headers['user-agent'] || '') : '';
    await INSERT.into(AuditLogs).entries({
      userId,
      action,
      entity,
      entityId,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      success  : true
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err.message);
  }
}

function _id(req) {
  return req.params && req.params[0]
    ? (typeof req.params[0] === 'object' ? req.params[0].ID : req.params[0])
    : (req.data ? req.data.ID : null);
}
