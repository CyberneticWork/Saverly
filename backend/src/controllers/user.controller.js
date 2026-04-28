const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

exports.getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, phone: true,
        avatarUrl: true, role: true, createdAt: true, lastLoginAt: true,
        _count: {
          select: { shoppingLists: true, favourites: true, invoices: true, priceAlerts: true },
        },
      },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (req.file) updateData.avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return next(createError(400, 'Current password is incorrect.'));

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });

    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) { next(err); }
};

exports.updatePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pushToken },
    });
    res.json({ success: true, message: 'Push token updated.' });
  } catch (err) { next(err); }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: req.user.id,
          ...(unreadOnly === 'true' && { isRead: false }),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ success: true, data: notifications, unreadCount, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) { next(err); }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
};

exports.getAlerts = async (req, res, next) => {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: req.user.id, isActive: true },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, defaultUnit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
};

exports.createAlert = async (req, res, next) => {
  try {
    const { productId, targetPrice } = req.body;
    const alert = await prisma.priceAlert.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      create: { userId: req.user.id, productId, targetPrice: parseFloat(targetPrice) },
      update: { targetPrice: parseFloat(targetPrice), isActive: true, triggeredAt: null },
    });
    res.status(201).json({ success: true, data: alert });
  } catch (err) { next(err); }
};

exports.deleteAlert = async (req, res, next) => {
  try {
    await prisma.priceAlert.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Price alert removed.' });
  } catch (err) { next(err); }
};
