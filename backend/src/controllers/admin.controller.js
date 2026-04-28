const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers, activeUsers, totalProducts, totalSupermarkets,
      totalPrices, totalInvoices, pendingInvoices, recentInvoices,
      recentPrices, topProducts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.supermarket.count({ where: { isActive: true } }),
      prisma.price.count(),
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: 'REVIEW' } }),
      prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          supermarket: { select: { name: true } },
        },
      }),
      prisma.price.findMany({
        take: 5,
        orderBy: { recordedAt: 'desc' },
        include: {
          product: { select: { name: true } },
          supermarket: { select: { name: true } },
        },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { viewCount: 'desc' },
        where: { isActive: true },
        select: { id: true, name: true, viewCount: true, imageUrl: true },
      }),
    ]);

    // Users registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers30d = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers, activeUsers, newUsers30d,
          totalProducts, totalSupermarkets,
          totalPrices, totalInvoices, pendingInvoices,
        },
        recentInvoices,
        recentPrices,
        topProducts,
      },
    });
  } catch (err) { next(err); }
};

exports.listUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }),
      ...(role && { role }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          isActive: true, createdAt: true, lastLoginAt: true,
          _count: { select: { invoices: true, shoppingLists: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true, data: users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, avatarUrl: true, createdAt: true, lastLoginAt: true,
        _count: { select: { invoices: true, shoppingLists: true, favourites: true } },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true, totalAmount: true },
        },
      },
    });
    if (!user) return next(createError(404, 'User not found.'));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, isActive } = req.body;
    // Prevent self-demotion
    if (req.params.id === req.user.id && role && role !== 'ADMIN') {
      return next(createError(400, 'Cannot change your own role.'));
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, email, role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return next(createError(400, 'Cannot delete your own account.'));
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
};

exports.toggleUserActive = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return next(createError(404, 'User not found.'));
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });
    res.json({ success: true, data: { isActive: updated.isActive } });
  } catch (err) { next(err); }
};

exports.listPrices = async (req, res, next) => {
  try {
    const { productId, supermarketId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(productId && { productId }),
      ...(supermarketId && { supermarketId }),
    };

    const [prices, total] = await Promise.all([
      prisma.price.findMany({
        where,
        include: {
          product: { select: { id: true, name: true } },
          supermarket: { select: { id: true, name: true } },
        },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.price.count({ where }),
    ]);

    res.json({
      success: true, data: prices,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) { next(err); }
};

exports.priceAnalytics = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const pricesByDay = await prisma.$queryRaw`
      SELECT DATE(recordedAt) as date, COUNT(*) as count
      FROM prices
      WHERE recordedAt >= ${since}
      GROUP BY DATE(recordedAt)
      ORDER BY date ASC
    `;

    const pricesBySource = await prisma.$queryRaw`
      SELECT source, COUNT(*) as count
      FROM prices
      GROUP BY source
    `;

    res.json({ success: true, data: { pricesByDay, pricesBySource } });
  } catch (err) { next(err); }
};

exports.userAnalytics = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const usersByDay = await prisma.$queryRaw`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM users
      WHERE createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    res.json({ success: true, data: { usersByDay } });
  } catch (err) { next(err); }
};

exports.productAnalytics = async (req, res, next) => {
  try {
    const topViewed = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: { id: true, name: true, viewCount: true, imageUrl: true,
        category: { select: { name: true } } },
    });

    const mostFavourited = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { favourites: { _count: 'desc' } },
      take: 10,
      select: { id: true, name: true, imageUrl: true,
        _count: { select: { favourites: true } },
        category: { select: { name: true } } },
    });

    res.json({ success: true, data: { topViewed, mostFavourited } });
  } catch (err) { next(err); }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { type = 'prices', from, to } = req.query;

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    let data;
    if (type === 'prices') {
      data = await prisma.price.findMany({
        where: { ...(from || to ? { recordedAt: dateFilter } : {}) },
        include: {
          product: { select: { name: true, brand: true } },
          supermarket: { select: { name: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 10000,
      });
    } else if (type === 'users') {
      data = await prisma.user.findMany({
        where: { ...(from || to ? { createdAt: dateFilter } : {}) },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });
    } else if (type === 'invoices') {
      data = await prisma.invoice.findMany({
        where: { ...(from || to ? { createdAt: dateFilter } : {}) },
        include: {
          user: { select: { name: true, email: true } },
          supermarket: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });
    }

    // Convert to CSV
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [], message: 'No data found.' });
    }

    const keys = Object.keys(flattenObject(data[0]));
    const csvRows = [
      keys.join(','),
      ...data.map(row =>
        keys.map(k => {
          const val = getNestedValue(row, k);
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
        }).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${Date.now()}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) { next(err); }
};

function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
      Object.assign(acc, flattenObject(obj[key], fullKey));
    } else {
      acc[fullKey] = obj[key];
    }
    return acc;
  }, {});
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
