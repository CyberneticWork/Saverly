const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const lists = await prisma.shoppingList.findMany({
      where: { userId: req.user.id, isActive: true },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 3,
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json({ success: true, data: lists });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const list = await prisma.shoppingList.create({
      data: { userId: req.user.id, name, description },
    });
    res.status(201).json({ success: true, data: list });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const list = await prisma.shoppingList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, imageUrl: true, brand: true, defaultUnit: true,
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });
    if (!list) return next(createError(404, 'Shopping list not found.'));
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const list = await prisma.shoppingList.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { name, description, updatedAt: new Date() },
    });
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.shoppingList.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Shopping list deleted.' });
  } catch (err) { next(err); }
};

exports.addItem = async (req, res, next) => {
  try {
    const { productId, quantity, unit, note } = req.body;

    const list = await prisma.shoppingList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!list) return next(createError(404, 'Shopping list not found.'));

    const item = await prisma.shoppingListItem.upsert({
      where: { shoppingListId_productId: { shoppingListId: list.id, productId } },
      create: { shoppingListId: list.id, productId, quantity: parseFloat(quantity), unit, note },
      update: { quantity: parseFloat(quantity), unit, note },
    });

    await prisma.shoppingList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });

    const populated = await prisma.shoppingListItem.findUnique({
      where: { id: item.id },
      include: { product: { select: { id: true, name: true, imageUrl: true, defaultUnit: true } } },
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { quantity, unit, note } = req.body;
    const item = await prisma.shoppingListItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
        ...(unit !== undefined && { unit }),
        ...(note !== undefined && { note }),
      },
    });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    await prisma.shoppingListItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true, message: 'Item removed.' });
  } catch (err) { next(err); }
};

exports.toggleCheck = async (req, res, next) => {
  try {
    const item = await prisma.shoppingListItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return next(createError(404, 'Item not found.'));

    const updated = await prisma.shoppingListItem.update({
      where: { id: item.id },
      data: { isChecked: !item.isChecked },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

/**
 * Optimise shopping list — find the cheapest store combination.
 * Returns: total per supermarket, cheapest items per supermarket,
 *          and the recommended single-store option.
 */
exports.optimize = async (req, res, next) => {
  try {
    const list = await prisma.shoppingList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true, defaultUnit: true } },
          },
        },
      },
    });
    if (!list) return next(createError(404, 'Shopping list not found.'));

    const productIds = list.items.map(i => i.product.id);
    if (productIds.length === 0) {
      return res.json({ success: true, data: { recommendations: [], bestSingleStore: null } });
    }

    // Get latest prices for all products across all supermarkets
    const priceMap = {}; // { supermarketId: { productId: effectivePrice } }
    const supermarketNames = {};

    for (const productId of productIds) {
      const rows = await prisma.$queryRaw`
        SELECT p.price, p.isOnSale, p.salePrice,
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

      for (const row of rows) {
        if (!priceMap[row.supermarketId]) {
          priceMap[row.supermarketId] = {};
          supermarketNames[row.supermarketId] = {
            name: row.supermarketName,
            logoUrl: row.logoUrl,
            primaryColor: row.primaryColor,
          };
        }
        const effectivePrice = row.isOnSale && row.salePrice ? row.salePrice : row.price;
        priceMap[row.supermarketId][productId] = effectivePrice;
      }
    }

    // Calculate totals per supermarket (only count items they carry)
    const supermarketTotals = Object.entries(priceMap).map(([smId, prices]) => {
      let total = 0;
      let itemCount = 0;
      const itemBreakdown = [];

      for (const item of list.items) {
        const price = prices[item.product.id];
        if (price !== undefined) {
          const lineTotal = price * item.quantity;
          total += lineTotal;
          itemCount++;
          itemBreakdown.push({
            product: item.product,
            quantity: item.quantity,
            unitPrice: price,
            lineTotal,
          });
        }
      }

      return {
        supermarketId: smId,
        ...supermarketNames[smId],
        total: Math.round(total * 100) / 100,
        itemCount,
        totalItems: list.items.length,
        coverage: Math.round((itemCount / list.items.length) * 100),
        items: itemBreakdown,
      };
    });

    // Best single store (most items covered, then lowest total)
    const fullCoverageStores = supermarketTotals.filter(s => s.itemCount === list.items.length);
    const bestSingleStore = fullCoverageStores.length > 0
      ? fullCoverageStores.sort((a, b) => a.total - b.total)[0]
      : supermarketTotals.sort((a, b) => {
          if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
          return a.total - b.total;
        })[0];

    // Per-item cheapest
    const itemCheapest = list.items.map(item => {
      const itemPrices = Object.entries(priceMap)
        .filter(([, prices]) => prices[item.product.id] !== undefined)
        .map(([smId, prices]) => ({
          supermarketId: smId,
          ...supermarketNames[smId],
          price: prices[item.product.id],
        }))
        .sort((a, b) => a.price - b.price);

      return {
        product: item.product,
        quantity: item.quantity,
        cheapestAt: itemPrices[0] || null,
        allPrices: itemPrices,
        savings: itemPrices.length > 1
          ? Math.round((itemPrices[itemPrices.length - 1].price - itemPrices[0].price) * 100) / 100
          : 0,
      };
    });

    res.json({
      success: true,
      data: {
        listName: list.name,
        totalItems: list.items.length,
        supermarketComparison: supermarketTotals.sort((a, b) => a.total - b.total),
        bestSingleStore,
        itemCheapest,
        totalPotentialSavings: itemCheapest.reduce((s, i) => s + i.savings, 0),
      },
    });
  } catch (err) { next(err); }
};
