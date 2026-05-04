'use strict';

const cds = require('@sap/cds');
const { validateEmail, validatePhone, validateName, validateLicenseNumber } = require('./utils/validators');
const { generateAuditLog, generateNotification, deepClone } = require('./utils/helpers');
const { AUDIT_ACTIONS, NOTIFICATION_TYPE, CONFIDENTIALITY_LEVEL } = require('./utils/constants');

module.exports = class DataService extends cds.ApplicationService {

  async init() {
    const { Patients, Doctors, DoctorPatient, MedicalRecords, AuditLogs, Notifications } = this.entities;

    // ─── PATIENT HOOKS ───────────────────────────────────────────────────────────

    this.before('CREATE', Patients, async (req) => {
      await this._validatePatient(req, req.data, false);
    });

    this.before('UPDATE', Patients, async (req) => {
      await this._validatePatient(req, req.data, true);
    });

    this.after('CREATE', Patients, async (data, req) => {
      await this._auditAndNotifyPatientCreate(data, req);
    });

    this.after('UPDATE', Patients, async (data, req) => {
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'Patients', data.ID, null, data, req);
    });

    this.before('DELETE', Patients, async (req) => {
      // Soft delete: set isActive = false instead of removing the row
      const { ID } = req.params[0] || req.data;
      if (!ID) return;
      await UPDATE(Patients).set({ isActive: false }).where({ ID });
      req.reject(200, 'Patient deactivated');
    });

    // ─── Custom actions ──────────────────────────────────────────────────────────
    this.on('deactivatePatient', Patients, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Patients).set({ isActive: false }).where({ ID });
      const patient = await SELECT.one.from(Patients).where({ ID });
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'Patients', ID, null, { isActive: false }, req);
      return patient;
    });

    this.on('activatePatient', Patients, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Patients).set({ isActive: true }).where({ ID });
      const patient = await SELECT.one.from(Patients).where({ ID });
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'Patients', ID, null, { isActive: true }, req);
      return patient;
    });

    // ─── DOCTOR HOOKS ────────────────────────────────────────────────────────────

    this.before('CREATE', Doctors, async (req) => {
      await this._validateDoctor(req, req.data);
    });

    this.before('UPDATE', Doctors, async (req) => {
      await this._validateDoctor(req, req.data);
    });

    this.after('CREATE', Doctors, async (data, req) => {
      await this._auditWrite(AUDIT_ACTIONS.CREATE, 'Doctors', data.ID, null, data, req);
    });

    this.after('UPDATE', Doctors, async (data, req) => {
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'Doctors', data.ID, null, data, req);
    });

    this.before('DELETE', Doctors, async (req) => {
      const { ID } = req.params[0] || req.data;
      if (!ID) return;
      await UPDATE(Doctors).set({ isActive: false }).where({ ID });
      req.reject(200, 'Doctor deactivated');
    });

    this.on('deactivateDoctor', Doctors, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Doctors).set({ isActive: false }).where({ ID });
      const doctor = await SELECT.one.from(Doctors).where({ ID });
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'Doctors', ID, null, { isActive: false }, req);
      return doctor;
    });

    // ─── MEDICAL RECORDS HOOKS ──────────────────────────────────────────────────

    this.before('READ', MedicalRecords, async (req) => {
      // Enforce confidentiality: restricted records only visible to admin
      const roles = req.user ? req.user.roles : [];
      const isAdmin = roles.includes('admin');
      if (!isAdmin) {
        // Append a filter to exclude restricted records
        const existingWhere = req.query.SELECT.where || [];
        const extra = { ref: ['confidentiality'] }, ne = '!=', val = { val: CONFIDENTIALITY_LEVEL.RESTRICTED };
        req.query.SELECT.where = existingWhere.length > 0
          ? [existingWhere, 'and', [extra, ne, val]]
          : [extra, ne, val];
      }
    });

    this.after('CREATE', MedicalRecords, async (data, req) => {
      await this._auditWrite(AUDIT_ACTIONS.CREATE, 'MedicalRecords', data.ID, null, data, req);
    });

    this.after('UPDATE', MedicalRecords, async (data, req) => {
      await this._auditWrite(AUDIT_ACTIONS.UPDATE, 'MedicalRecords', data.ID, null, data, req);
    });

    this.before('DELETE', MedicalRecords, async (req) => {
      const { ID } = req.params[0] || req.data;
      if (!ID) return;
      await UPDATE(MedicalRecords).set({ isDeleted: true }).where({ ID });
      req.reject(200, 'Medical record archived');
    });

    // ─── SEARCH ─────────────────────────────────────────────────────────────────
    this.on('searchPatients', async (req) => {
      const { query } = req.data;
      if (!query || query.trim().length === 0) {
        return SELECT.from(Patients).limit(50);
      }
      const q = `%${query.trim().toLowerCase()}%`;
      return SELECT.from(Patients)
        .where(`lower(firstName) like '${q}' or lower(lastName) like '${q}' or lower(email) like '${q}'`)
        .limit(50);
    });

    // ─── SYSTEM STATS ───────────────────────────────────────────────────────────
    this.on('getSystemStats', async () => {
      const { Appointments } = this.entities;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const [
        [{ count: totalPatients }],
        [{ count: totalDoctors }],
        [{ count: totalAppointments }],
        [{ count: todaysAppointments }],
        [{ count: pendingNotifications }]
      ] = await Promise.all([
        cds.run(SELECT.one.from(Patients).columns('count(*) as count')),
        cds.run(SELECT.one.from(Doctors).columns('count(*) as count')),
        cds.run(SELECT.one.from(Appointments).columns('count(*) as count')),
        cds.run(SELECT.one.from(Appointments).columns('count(*) as count')
          .where({ scheduledDate: { between: today, and: tomorrow } })),
        cds.run(SELECT.one.from(Notifications).columns('count(*) as count').where({ isRead: false }))
      ]);

      return {
        totalPatients      : Number(totalPatients),
        totalDoctors       : Number(totalDoctors),
        totalAppointments  : Number(totalAppointments),
        todaysAppointments : Number(todaysAppointments),
        pendingNotifications: Number(pendingNotifications)
      };
    });

    this.on('getUnreadNotificationCount', async (req) => {
      const { userId } = req.data;
      const result = await SELECT.one.from(Notifications)
        .columns('count(*) as count')
        .where({ isRead: false, patient_ID: userId });
      return Number(result ? result.count : 0);
    });

    this.on('getDoctorAvailability', async (req) => {
      const { doctorId, date } = req.data;
      const { getTimeSlots, timeSlotsOverlap, getAppointmentEndTime } = require('./utils/helpers');
      const { Appointments } = this.entities;

      const slots = getTimeSlots(date, 30);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const bookedAppts = await SELECT.from(Appointments)
        .where({
          doctor_ID    : doctorId,
          status       : { '!=': 'cancelled' },
          scheduledDate: { between: dayStart, and: dayEnd }
        });

      return slots.map(slot => {
        const taken = bookedAppts.some(appt => {
          const apptEnd = getAppointmentEndTime(appt.scheduledDate, appt.duration || 30);
          return timeSlotsOverlap(slot.startTime, slot.endTime, new Date(appt.scheduledDate), apptEnd);
        });
        return { ...slot, available: !taken };
      });
    });

    // Notifications: mark as read
    this.on('markAsRead', Notifications, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Notifications).set({ isRead: true, readAt: new Date() }).where({ ID });
      return SELECT.one.from(Notifications).where({ ID });
    });

    this.on('markAllAsRead', Notifications, async (req) => {
      const userId = req.user ? req.user.id : null;
      if (userId) {
        await UPDATE(Notifications).set({ isRead: true, readAt: new Date() })
          .where({ isRead: false, patient_ID: userId });
      }
      return true;
    });

    await super.init();
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  async _validatePatient(req, data, isUpdate) {
    if (data.email) {
      const emailResult = validateEmail(data.email);
      if (!emailResult.valid) return req.error(400, emailResult.error);

      // Uniqueness check
      const { Patients } = this.entities;
      const query = SELECT.one.from(Patients).where({ email: data.email });
      if (isUpdate && req.params && req.params[0]) {
        const { ID } = req.params[0];
        query.where({ ID: { '!=': ID } });
      }
      const existing = await cds.run(query);
      if (existing) return req.error(409, `A patient with email ${data.email} already exists`);
    }

    if (data.phone) {
      const phoneResult = validatePhone(data.phone);
      if (!phoneResult.valid) return req.error(400, phoneResult.error);
    }

    if (data.firstName) {
      const nameResult = validateName(data.firstName, 'First name');
      if (!nameResult.valid) return req.error(400, nameResult.error);
    }

    if (data.lastName) {
      const nameResult = validateName(data.lastName, 'Last name');
      if (!nameResult.valid) return req.error(400, nameResult.error);
    }
  }

  async _validateDoctor(req, data) {
    if (data.email) {
      const emailResult = validateEmail(data.email);
      if (!emailResult.valid) return req.error(400, emailResult.error);
    }

    if (data.phone) {
      const phoneResult = validatePhone(data.phone);
      if (!phoneResult.valid) return req.error(400, phoneResult.error);
    }

    if (data.licenseNumber) {
      const licenseResult = validateLicenseNumber(data.licenseNumber);
      if (!licenseResult.valid) return req.error(400, licenseResult.error);

      // License uniqueness
      const { Doctors } = this.entities;
      const existing = await SELECT.one.from(Doctors).where({ licenseNumber: data.licenseNumber });
      if (existing && existing.ID !== data.ID) {
        return req.error(409, `License number ${data.licenseNumber} is already registered`);
      }
    }
  }

  async _auditAndNotifyPatientCreate(data, req) {
    await this._auditWrite(AUDIT_ACTIONS.CREATE, 'Patients', data.ID, null, data, req);

    const { Notifications } = this.entities;
    const notification = generateNotification(
      data.ID,
      null,
      'Welcome to MedSync',
      `Hello ${data.firstName} ${data.lastName}, your patient profile has been created successfully. Welcome to MedSync!`,
      NOTIFICATION_TYPE.SYSTEM
    );
    await INSERT.into(Notifications).entries(notification);
  }

  async _auditWrite(action, entity, entityId, oldValues, newValues, req) {
    try {
      const { AuditLogs } = this.entities;
      const userId = req.user ? req.user.id : 'anonymous';
      const ipAddress = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '') : '';
      const userAgent = req.headers ? (req.headers['user-agent'] || '') : '';
      const log = generateAuditLog(userId, action, entity, entityId, oldValues, newValues, ipAddress, userAgent);
      await INSERT.into(AuditLogs).entries(log);
    } catch (err) {
      // Audit failures must not block main operations
      console.error('[AuditLog] Failed to write audit entry:', err.message);
    }
  }
};
