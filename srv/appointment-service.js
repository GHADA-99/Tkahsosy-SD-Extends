'use strict';

const cds = require('@sap/cds');
const { validateAppointmentTime, validateStatusTransition } = require('./utils/validators');
const { generateNotification, generateAuditLog, getAppointmentEndTime, getReminderTime, timeSlotsOverlap } = require('./utils/helpers');
const { APPOINTMENT_STATUS, NOTIFICATION_TYPE, AUDIT_ACTIONS } = require('./utils/constants');

module.exports = class AppointmentService extends cds.ApplicationService {

  async init() {
    const { Appointments, Notifications, AuditLogs } = this.entities;

    // ─── BEFORE CREATE ───────────────────────────────────────────────────────────
    this.before('CREATE', Appointments, async (req) => {
      const data = req.data;

      // Validate appointment time
      if (data.scheduledDate) {
        const duration = data.duration || 30;
        const timeResult = validateAppointmentTime(data.scheduledDate, duration);
        if (!timeResult.valid) return req.error(400, timeResult.error);
      }

      // Check for conflicts
      if (data.doctor_ID && data.scheduledDate) {
        const conflict = await this._checkDoctorConflict(
          data.doctor_ID,
          data.scheduledDate,
          data.duration || 30,
          null
        );
        if (conflict) {
          return req.error(409, `Doctor already has an appointment at ${new Date(data.scheduledDate).toLocaleString()}. Please choose a different time slot.`);
        }

        // Also check patient conflicts
        if (data.patient_ID) {
          const patientConflict = await this._checkPatientConflict(
            data.patient_ID,
            data.scheduledDate,
            data.duration || 30,
            null
          );
          if (patientConflict) {
            return req.error(409, 'Patient already has an appointment at this time slot.');
          }
        }
      }

      // Default status
      if (!data.status) data.status = APPOINTMENT_STATUS.SCHEDULED;
    });

    // ─── BEFORE UPDATE ───────────────────────────────────────────────────────────
    this.before('UPDATE', Appointments, async (req) => {
      const data = req.data;
      const { ID } = req.params[0] || {};
      if (!ID) return;

      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, `Appointment ${ID} not found`);

      // Status transition validation
      if (data.status && data.status !== existing.status) {
        const transition = validateStatusTransition(existing.status, data.status);
        if (!transition.valid) return req.error(400, transition.error);
      }

      // Date/conflict checks on reschedule
      if (data.scheduledDate && data.scheduledDate !== existing.scheduledDate) {
        const duration = data.duration || existing.duration || 30;
        const timeResult = validateAppointmentTime(data.scheduledDate, duration);
        if (!timeResult.valid) return req.error(400, timeResult.error);

        const doctorId = data.doctor_ID || existing.doctor_ID;
        if (doctorId) {
          const conflict = await this._checkDoctorConflict(doctorId, data.scheduledDate, duration, ID);
          if (conflict) {
            return req.error(409, 'Doctor already has an appointment at the new time slot.');
          }
        }
      }
    });

    // ─── AFTER CREATE ────────────────────────────────────────────────────────────
    this.after('CREATE', Appointments, async (data, req) => {
      await this._notifyAppointmentCreated(data, req);
      await this._writeAudit(AUDIT_ACTIONS.CREATE, 'Appointments', data.ID, null, data, req);
    });

    this.after('UPDATE', Appointments, async (data, req) => {
      await this._writeAudit(AUDIT_ACTIONS.UPDATE, 'Appointments', data.ID, null, data, req);
    });

    // ─── BEFORE DELETE ───────────────────────────────────────────────────────────
    this.before('DELETE', Appointments, async (req) => {
      const { ID } = req.params[0] || req.data;
      if (!ID) return;
      await UPDATE(Appointments).set({ isDeleted: true, status: APPOINTMENT_STATUS.CANCELLED }).where({ ID });
      req.reject(200, 'Appointment cancelled');
    });

    // ─── ACTIONS ─────────────────────────────────────────────────────────────────

    this.on('cancelAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const { reason } = req.data;
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');

      const transition = validateStatusTransition(existing.status, APPOINTMENT_STATUS.CANCELLED);
      if (!transition.valid) return req.error(400, transition.error);

      await UPDATE(Appointments).set({
        status      : APPOINTMENT_STATUS.CANCELLED,
        cancelReason: reason || 'No reason provided'
      }).where({ ID });

      const updated = await SELECT.one.from(Appointments).where({ ID });

      // Notify patient and doctor
      const apptTime = new Date(existing.scheduledDate).toLocaleString();
      if (existing.patient_ID) {
        await INSERT.into(Notifications).entries(
          generateNotification(
            existing.patient_ID, null,
            'Appointment Cancelled',
            `Your appointment scheduled for ${apptTime} has been cancelled. Reason: ${reason || 'Not specified'}`,
            NOTIFICATION_TYPE.APPOINTMENT
          )
        );
      }
      if (existing.doctor_ID) {
        await INSERT.into(Notifications).entries(
          generateNotification(
            null, existing.doctor_ID,
            'Appointment Cancelled',
            `An appointment scheduled for ${apptTime} has been cancelled. Reason: ${reason || 'Not specified'}`,
            NOTIFICATION_TYPE.APPOINTMENT
          )
        );
      }

      await this._writeAudit(AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('rescheduleAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const { newDate, newDoctor } = req.data;
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');

      const allowedToReschedule = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED];
      if (!allowedToReschedule.includes(existing.status)) {
        return req.error(400, `Cannot reschedule an appointment with status '${existing.status}'`);
      }

      const duration = existing.duration || 30;
      const targetDate = newDate || existing.scheduledDate;
      const targetDoctor = newDoctor || existing.doctor_ID;

      const timeResult = validateAppointmentTime(targetDate, duration);
      if (!timeResult.valid) return req.error(400, timeResult.error);

      const conflict = await this._checkDoctorConflict(targetDoctor, targetDate, duration, ID);
      if (conflict) return req.error(409, 'Doctor already has an appointment at the new time slot.');

      await UPDATE(Appointments).set({
        scheduledDate: targetDate,
        doctor_ID    : targetDoctor,
        status       : APPOINTMENT_STATUS.RESCHEDULED
      }).where({ ID });

      const updated = await SELECT.one.from(Appointments).where({ ID });

      const apptTime = new Date(targetDate).toLocaleString();
      if (existing.patient_ID) {
        await INSERT.into(Notifications).entries(
          generateNotification(
            existing.patient_ID, null,
            'Appointment Rescheduled',
            `Your appointment has been rescheduled to ${apptTime}.`,
            NOTIFICATION_TYPE.APPOINTMENT
          )
        );
      }

      await this._writeAudit(AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('completeAppointment', Appointments, async (req) => {
      const { ID } = req.params[0];
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');

      const transition = validateStatusTransition(existing.status, APPOINTMENT_STATUS.COMPLETED);
      if (!transition.valid) return req.error(400, transition.error);

      await UPDATE(Appointments).set({ status: APPOINTMENT_STATUS.COMPLETED }).where({ ID });
      const updated = await SELECT.one.from(Appointments).where({ ID });

      if (existing.patient_ID) {
        await INSERT.into(Notifications).entries(
          generateNotification(
            existing.patient_ID, null,
            'Appointment Completed',
            `Your appointment on ${new Date(existing.scheduledDate).toLocaleDateString()} has been completed. Thank you for visiting MedSync.`,
            NOTIFICATION_TYPE.APPOINTMENT
          )
        );
      }

      await this._writeAudit(AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    this.on('markNoShow', Appointments, async (req) => {
      const { ID } = req.params[0];
      const existing = await SELECT.one.from(Appointments).where({ ID });
      if (!existing) return req.error(404, 'Appointment not found');

      const transition = validateStatusTransition(existing.status, APPOINTMENT_STATUS.NO_SHOW);
      if (!transition.valid) return req.error(400, transition.error);

      await UPDATE(Appointments).set({ status: APPOINTMENT_STATUS.NO_SHOW }).where({ ID });
      const updated = await SELECT.one.from(Appointments).where({ ID });

      await this._writeAudit(AUDIT_ACTIONS.UPDATE, 'Appointments', ID, existing, updated, req);
      return updated;
    });

    await super.init();
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  async _checkDoctorConflict(doctorId, scheduledDate, duration, excludeId) {
    const { Appointments } = this.entities;
    const apptStart = new Date(scheduledDate);
    const apptEnd = getAppointmentEndTime(apptStart, duration);

    // Fetch appointments for this doctor on the same day
    const dayStart = new Date(apptStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(apptStart);
    dayEnd.setHours(23, 59, 59, 999);

    const query = SELECT.from(Appointments).where({
      doctor_ID    : doctorId,
      isDeleted    : false,
      status       : { 'in': [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED, APPOINTMENT_STATUS.IN_PROGRESS] },
      scheduledDate: { between: dayStart, and: dayEnd }
    });

    const dayAppointments = await cds.run(query);

    for (const appt of dayAppointments) {
      if (excludeId && appt.ID === excludeId) continue;
      const existStart = new Date(appt.scheduledDate);
      const existEnd = getAppointmentEndTime(existStart, appt.duration || 30);
      if (timeSlotsOverlap(apptStart, apptEnd, existStart, existEnd)) {
        return appt;
      }
    }
    return null;
  }

  async _checkPatientConflict(patientId, scheduledDate, duration, excludeId) {
    const { Appointments } = this.entities;
    const apptStart = new Date(scheduledDate);
    const apptEnd = getAppointmentEndTime(apptStart, duration);

    const dayStart = new Date(apptStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(apptStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayAppointments = await cds.run(
      SELECT.from(Appointments).where({
        patient_ID   : patientId,
        isDeleted    : false,
        status       : { 'in': [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.RESCHEDULED, APPOINTMENT_STATUS.IN_PROGRESS] },
        scheduledDate: { between: dayStart, and: dayEnd }
      })
    );

    for (const appt of dayAppointments) {
      if (excludeId && appt.ID === excludeId) continue;
      const existStart = new Date(appt.scheduledDate);
      const existEnd = getAppointmentEndTime(existStart, appt.duration || 30);
      if (timeSlotsOverlap(apptStart, apptEnd, existStart, existEnd)) {
        return appt;
      }
    }
    return null;
  }

  async _notifyAppointmentCreated(data, req) {
    const { Notifications } = this.entities;
    const apptTime = new Date(data.scheduledDate).toLocaleString();

    const entries = [];

    if (data.patient_ID) {
      entries.push(
        generateNotification(
          data.patient_ID, null,
          'Appointment Confirmed',
          `Your appointment has been scheduled for ${apptTime}. Duration: ${data.duration || 30} minutes.`,
          NOTIFICATION_TYPE.APPOINTMENT,
          null,
          null
        )
      );

      // Reminder notification (24h before)
      const reminderTime = getReminderTime(data.scheduledDate);
      if (reminderTime > new Date()) {
        entries.push(
          generateNotification(
            data.patient_ID, null,
            'Appointment Reminder',
            `Reminder: You have an appointment tomorrow at ${new Date(data.scheduledDate).toLocaleTimeString()}.`,
            NOTIFICATION_TYPE.REMINDER,
            reminderTime,
            new Date(data.scheduledDate)
          )
        );
      }
    }

    if (data.doctor_ID) {
      entries.push(
        generateNotification(
          null, data.doctor_ID,
          'New Appointment',
          `A new appointment has been scheduled for ${apptTime}. Duration: ${data.duration || 30} minutes.`,
          NOTIFICATION_TYPE.APPOINTMENT
        )
      );
    }

    if (entries.length > 0) {
      await INSERT.into(Notifications).entries(entries);
    }
  }

  async _writeAudit(action, entity, entityId, oldValues, newValues, req) {
    try {
      const { AuditLogs } = this.entities;
      const userId = req.user ? req.user.id : 'anonymous';
      const ipAddress = req.headers ? (req.headers['x-forwarded-for'] || '') : '';
      const userAgent = req.headers ? (req.headers['user-agent'] || '') : '';
      const log = generateAuditLog(userId, action, entity, entityId, oldValues, newValues, ipAddress, userAgent);
      await INSERT.into(AuditLogs).entries(log);
    } catch (err) {
      console.error('[AuditLog] Appointment audit write failed:', err.message);
    }
  }
};
