const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');
const path = require('path');

const prisma = new PrismaClient();

const buildProductSelect = (userId) => ({
  id: true, name: true, slug: true, description: true, brand: true,
  defaultUnit: true, imageUrl: true, barcode: true, viewCount: true, createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { favourites: true, prices: true } },
  ...(userId ? {
    favourites: {
      where: { userId },
      select: { id: true },
    },
  } : {}),
});

exports.list = async (req, res, next) => {
  try {
    const { category, brand, page = 1, limit = 20, sortBy = 'name', order = 'asc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      ...(category && { category: { slug: category } }),
      ...(brand && { brand: { contains: brand } }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: buildProductSelect(req.user?.id),
        orderBy: { [sortBy]: order },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products.map(p => ({ ...p, isFavourite: p.favourites?.length > 0 })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const { q, category, page = 1, limit = 20 } = req.query;
    if (!q) return next(createError(400, 'Query parameter "q" is required.'));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      OR: [
        { name: { contains: q } },
        { brand: { contains: q } },
        { barcode: { equals: q } },
      ],
      ...(category && { category: { slug: category } }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: buildProductSelect(req.user?.id),
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    // Update view counts
    if (products.length > 0) {
      prisma.product.updateMany({
        where: { id: { in: products.map(p => p.id) } },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // fire and forget
    }

    res.json({
      success: true,
      data: products.map(p => ({ ...p, isFavourite: p.favourites?.length > 0 })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: buildProductSelect(req.user?.id),
    });
    if (!product) return next(createError(404, 'Product not found.'));

    // Get latest prices per supermarket
    const latestPrices = await prisma.$queryRaw`
      SELECT p.id, p.price, p.isOnSale, p.salePrice, p.recordedAt, p.isVerified,
        s.id as supermarketId, s.name as supermarketName, s.logoUrl, s.primaryColor
      FROM prices p
      JOIN supermarkets s ON p.supermarketId = s.id
      JOIN (
        SELECT supermarketId, MAX(recordedAt) as maxDate
        FROM prices
        WHERE productId = ${req.params.id}
        GROUP BY supermarketId
      ) latest ON p.supermarketId = latest.supermarketId AND p.recordedAt = latest.maxDate
      WHERE p.productId = ${req.params.id} AND s.isActive = true
    `;

    res.json({
      success: true,
      data: {
        ...product,
        isFavourite: product.favourites?.length > 0,
        currentPrices: latestPrices,
      },
    });
  } catch (err) { next(err); }
};

exports.getPrices = async (req, res, next) => {
  try {
    const { id } = req.params;
    const latestPrices = await prisma.$queryRaw`
      SELECT p.id, p.price, p.unit, p.isOnSale, p.salePrice, p.saleEndsAt,
        p.recordedAt, p.isVerified, p.source,
        s.id as supermarketId, s.name as supermarketName, s.logoUrl, s.primaryColor
      FROM prices p
      JOIN supermarkets s ON p.supermarketId = s.id
      JOIN (
        SELECT supermarketId, MAX(recordedAt) as maxDate
        FROM prices
        WHERE productId = ${id}
        GROUP BY supermarketId
      ) latest ON p.supermarketId = latest.supermarketId AND p.recordedAt = latest.maxDate
      WHERE p.productId = ${id} AND s.isActive = true
    `;

    const sorted = [...latestPrices].sort((a, b) =>
      (a.isOnSale ? a.salePrice : a.price) - (b.isOnSale ? b.salePrice : b.price)
    );

    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
};

exports.getPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supermarketId, days = 90 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const where = {
      productId: id,
      recordedAt: { gte: since },
      ...(supermarketId && { supermarketId }),
    };

    const history = await prisma.price.findMany({
      where,
      select: {
        id: true, price: true, isOnSale: true, salePrice: true, recordedAt: true,
        supermarket: { select: { id: true, name: true, primaryColor: true } },
      },
      orderBy: { recordedAt: 'asc' },
    });

    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};

exports.getCheapest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prices = await prisma.$queryRaw`
      SELECT p.price, p.isOnSale, p.salePrice,
        s.id as supermarketId, s.name as supermarketName, s.logoUrl
      FROM prices p
      JOIN supermarkets s ON p.supermarketId = s.id
      JOIN (
        SELECT supermarketId, MAX(recordedAt) as maxDate
        FROM prices
        WHERE productId = ${id}
        GROUP BY supermarketId
      ) latest ON p.supermarketId = latest.supermarketId AND p.recordedAt = latest.maxDate
      WHERE p.productId = ${id} AND s.isActive = true
    `;

    if (prices.length === 0) return next(createError(404, 'No prices found for this product.'));

    const cheapest = prices.reduce((min, p) => {
      const eff = p.isOnSale ? p.salePrice : p.price;
      const minEff = min.isOnSale ? min.salePrice : min.price;
      return eff < minEff ? p : min;
    });

    res.json({ success: true, data: cheapest });
  } catch (err) { next(err); }
};

exports.toggleFavourite = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user.id;

    const existing = await prisma.favourite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.favourite.delete({ where: { userId_productId: { userId, productId } } });
      res.json({ success: true, isFavourite: false, message: 'Removed from favourites.' });
    } else {
      await prisma.favourite.create({ data: { userId, productId } });
      res.json({ success: true, isFavourite: true, message: 'Added to favourites.' });
    }
  } catch (err) { next(err); }
};

exports.getFavourites = async (req, res, next) => {
  try {
    const favourites = await prisma.favourite.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true, imageUrl: true, brand: true, defaultUnit: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: favourites.map(f => f.product) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, slug, description, categoryId, brand, defaultUnit, barcode } = req.body;
    const imageUrl = req.file
      ? `/uploads/products/${req.file.filename}`
      : undefined;

    const product = await prisma.product.create({
      data: { name, slug, description, categoryId, brand, defaultUnit, barcode, imageUrl },
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/products/${req.file.filename}`;
    delete data.id;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) { next(err); }
};
