'use strict';

const cds = require('@sap/cds');
const { generateNotification } = require('./utils/helpers');
const { NOTIFICATION_TYPE } = require('./utils/constants');

module.exports = class NotificationService extends cds.ApplicationService {

  async init() {
    const { Notifications } = this.entities;

    // ─── BEFORE READ: filter by current user unless admin ────────────────────────
    this.before('READ', Notifications, async (req) => {
      const user = req.user;
      if (!user) return;
      const roles = user.roles || [];
      if (roles.includes('admin')) return; // Admins see all

      // Append user-specific filter
      const userId = user.id;
      if (userId) {
        const extra = `(patient_ID = '${userId}' or doctor_ID = '${userId}')`;
        if (!req.query.SELECT.where) {
          req.query.SELECT.where = [extra];
        } else {
          req.query.SELECT.where = [req.query.SELECT.where, 'and', extra];
        }
      }
    });

    // ─── MARK AS READ ────────────────────────────────────────────────────────────
    this.on('markAsRead', Notifications, async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Notifications).set({
        isRead: true,
        readAt: new Date().toISOString()
      }).where({ ID });
      return SELECT.one.from(Notifications).where({ ID });
    });

    // ─── MARK ALL AS READ ────────────────────────────────────────────────────────
    this.on('markAllAsRead', Notifications, async (req) => {
      const userId = req.user ? req.user.id : null;
      if (!userId) return false;
      await UPDATE(Notifications)
        .set({ isRead: true, readAt: new Date().toISOString() })
        .where({ isRead: false, patient_ID: userId });
      return true;
    });

    // ─── UNREAD COUNT ────────────────────────────────────────────────────────────
    this.on('getUnreadNotificationCount', async (req) => {
      const { userId } = req.data;
      const targetId = userId || (req.user ? req.user.id : null);
      if (!targetId) return 0;
      const result = await SELECT.one.from(Notifications)
        .columns('count(*) as count')
        .where({ isRead: false, patient_ID: targetId });
      return Number(result ? result.count : 0);
    });

    // ─── AUTO-CLEANUP of expired notifications (older than 90 days) ──────────────
    this.on('cleanupOldNotifications', async (req) => {
      const roles = req.user ? req.user.roles : [];
      if (!roles.includes('admin')) {
        return req.error(403, 'Only admins can trigger notification cleanup');
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const result = await DELETE.from(Notifications)
        .where({ isRead: true, createdAt: { '<': cutoff } });
      return { deleted: result || 0 };
    });

    await super.init();
  }

  /**
   * Programmatic helper: create a notification from any service handler.
   * @param {string|null} patientId
   * @param {string|null} doctorId
   * @param {string} title
   * @param {string} message
   * @param {string} [type]
   */
  static async createNotification(patientId, doctorId, title, message, type = NOTIFICATION_TYPE.SYSTEM) {
    const { Notifications } = cds.entities('medsync');
    const notification = generateNotification(patientId, doctorId, title, message, type);
    await INSERT.into(Notifications).entries(notification);
  }
};
