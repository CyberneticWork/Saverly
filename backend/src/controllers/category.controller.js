const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) return next(createError(404, 'Category not found.'));
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    const cat = await prisma.category.create({ data: { name, slug, description, sortOrder: sortOrder || 0 } });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const cat = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.category.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Category deactivated.' });
  } catch (err) { next(err); }
};
