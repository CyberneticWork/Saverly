const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { createError } = require('./errorHandler');

const prisma = new PrismaClient();

/**
 * Verify JWT and attach user to req.user.
 */
const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Access token required.'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(createError(401, 'Account not found or deactivated.'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Require ADMIN role.
 */
const requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return next(createError(403, 'Admin access required.'));
  }
  next();
};

/**
 * Optional authentication — attaches user if token present, continues anyway.
 */
const optionalAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      if (user?.isActive) req.user = user;
    }
  } catch {
    // ignore invalid tokens in optional mode
  }
  next();
};

module.exports = { authenticate, requireAdmin, optionalAuth };
