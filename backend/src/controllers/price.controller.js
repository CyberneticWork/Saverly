const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

/**
 * Compare prices for multiple products across all supermarkets.
 * Query: ?productIds=id1,id2,id3
 */
exports.compare = async (req, res, next) => {
  try {
    const { productIds } = req.query;
    if (!productIds) return next(createError(400, 'productIds query param required.'));

    const ids = productIds.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) return next(createError(400, 'At least one product ID required.'));

    const result = [];
    for (const productId of ids) {
      const latestPrices = await prisma.$queryRaw`
        SELECT p.id, p.price, p.isOnSale, p.salePrice, p.recordedAt,
          s.id as supermarketId, s.name as supermarketName, s.logoUrl, s.primaryColor
        FROM prices p
        JOIN supermarkets s ON p.supermarketId = s.id
        JOIN (
          SELECT supermarketId, MAX(recordedAt) as maxDate
          FROM prices
          WHERE productId = ${productId}
          GROUP BY supermarketId
        ) latest ON p.supermarketId = latest.supermarketId AND p.recordedAt = latest.maxDate
        WHERE p.productId = ${productId} AND s.isActive = true
      `;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, imageUrl: true, defaultUnit: true },
      });

      if (product) {
        const sorted = [...latestPrices].sort((a, b) =>
          (a.isOnSale ? a.salePrice : a.price) - (b.isOnSale ? b.salePrice : b.price)
        );
        result.push({ product, prices: sorted });
      }
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { productId, supermarketId, price, unit, isOnSale, salePrice, saleEndsAt } = req.body;

    const priceRecord = await prisma.price.create({
      data: {
        productId, supermarketId,
        price: parseFloat(price),
        unit: unit || 'unit',
        isOnSale: isOnSale || false,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : null,
        isVerified: true,
        source: 'manual',
      },
    });

    // Check price alerts
    checkPriceAlerts(productId, parseFloat(price));

    res.status(201).json({ success: true, data: priceRecord });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.price) data.price = parseFloat(data.price);
    if (data.salePrice) data.salePrice = parseFloat(data.salePrice);

    const priceRecord = await prisma.price.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: priceRecord });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.price.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Price record deleted.' });
  } catch (err) { next(err); }
};

exports.bulkCreate = async (req, res, next) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return next(createError(400, 'prices must be an array.'));

    const created = await prisma.price.createMany({
      data: prices.map(p => ({
        ...p,
        price: parseFloat(p.price),
        isVerified: true,
        source: 'manual',
      })),
    });

    res.status(201).json({ success: true, data: { count: created.count } });
  } catch (err) { next(err); }
};

/**
 * Fire-and-forget: notify users whose price alert has been triggered.
 */
async function checkPriceAlerts(productId, newPrice) {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { productId, isActive: true, targetPrice: { gte: newPrice } },
      include: { user: { select: { id: true, pushToken: true, name: true } }, product: { select: { name: true } } },
    });

    for (const alert of alerts) {
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          title: '💰 Price Drop Alert!',
          body: `${alert.product.name} is now $${newPrice.toFixed(2)} — below your target of $${alert.targetPrice.toFixed(2)}!`,
          type: 'PRICE_ALERT',
          data: { productId, price: newPrice },
        },
      });

      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date(), isActive: false },
      });
    }
  } catch {
    // Non-critical — log silently
  }
}
