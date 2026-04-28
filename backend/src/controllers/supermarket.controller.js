const { PrismaClient, Prisma } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

const slugify = (value = '') => value
  .toString()
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const pickSupermarketData = (body = {}) => {
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.website !== undefined) data.website = body.website;
  if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
  // Accept both logoUrl and legacy "logo" from older admin forms.
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  else if (body.logo !== undefined) data.logoUrl = body.logo;
  return data;
};

// Haversine distance in km
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

exports.list = async (req, res, next) => {
  try {
    const supermarkets = await prisma.supermarket.findMany({
      where: { isActive: true },
      include: {
        locations: { where: { isActive: true } },
        _count: { select: { prices: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: supermarkets });
  } catch (err) { next(err); }
};

exports.getNearby = async (req, res, next) => {
  try {
    const { lat, lon, radius = 10 } = req.query;
    if (!lat || !lon) return next(createError(400, 'lat and lon query params required.'));

    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const maxRadius = parseFloat(radius);

    const locations = await prisma.supermarketLocation.findMany({
      where: { isActive: true },
      include: { supermarket: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
    });

    const nearby = locations
      .map(loc => ({
        ...loc,
        distance: haversine(userLat, userLon, loc.latitude, loc.longitude),
      }))
      .filter(loc => loc.distance <= maxRadius)
      .sort((a, b) => a.distance - b.distance);

    res.json({ success: true, data: nearby });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const sm = await prisma.supermarket.findUnique({
      where: { id: req.params.id },
      include: {
        locations: { where: { isActive: true } },
        _count: { select: { prices: true } },
      },
    });
    if (!sm) return next(createError(404, 'Supermarket not found.'));
    res.json({ success: true, data: sm });
  } catch (err) { next(err); }
};

exports.getPrices = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const categoryFilter = category ? Prisma.sql`AND c.slug = ${category}` : Prisma.empty;

    const priceRows = await prisma.$queryRaw`
      SELECT p.id, p.price, p.isOnSale, p.salePrice, p.recordedAt,
        pd.id as productId, pd.name as productName, pd.imageUrl,
        pd.defaultUnit, c.name as categoryName
      FROM prices p
      JOIN products pd ON p.productId = pd.id
      JOIN categories c ON pd.categoryId = c.id
      JOIN (
        SELECT productId, MAX(recordedAt) as maxDate
        FROM prices
        WHERE supermarketId = ${id}
        GROUP BY productId
      ) latest ON p.productId = latest.productId AND p.recordedAt = latest.maxDate
      WHERE p.supermarketId = ${id} AND pd.isActive = true
      ${categoryFilter}
      LIMIT ${parseInt(limit)} OFFSET ${skip}
    `;

    res.json({ success: true, data: priceRows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = pickSupermarketData(req.body);
    if (!data.name) return next(createError(400, 'name is required.'));
    if (!data.slug) data.slug = slugify(data.name);

    const sm = await prisma.supermarket.create({ data });
    res.status(201).json({ success: true, data: sm });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = pickSupermarketData(req.body);
    if (!data.slug && data.name) data.slug = slugify(data.name);

    const sm = await prisma.supermarket.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: sm });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.supermarket.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Supermarket deactivated.' });
  } catch (err) { next(err); }
};

exports.addLocation = async (req, res, next) => {
  try {
    const loc = await prisma.supermarketLocation.create({
      data: { ...req.body, supermarketId: req.params.id },
    });
    res.status(201).json({ success: true, data: loc });
  } catch (err) { next(err); }
};

exports.updateLocation = async (req, res, next) => {
  try {
    const loc = await prisma.supermarketLocation.update({
      where: { id: req.params.locationId },
      data: req.body,
    });
    res.json({ success: true, data: loc });
  } catch (err) { next(err); }
};
