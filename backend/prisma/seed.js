const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin user ──────────────────────────────────────────
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@pricewise.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@pricewise.com',
      password: adminPassword,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // ── Categories ──────────────────────────────────────────
  const categories = [
    { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 1 },
    { name: 'Dairy & Eggs', slug: 'dairy-eggs', sortOrder: 2 },
    { name: 'Meat & Seafood', slug: 'meat-seafood', sortOrder: 3 },
    { name: 'Bakery & Bread', slug: 'bakery-bread', sortOrder: 4 },
    { name: 'Beverages', slug: 'beverages', sortOrder: 5 },
    { name: 'Snacks & Confectionery', slug: 'snacks-confectionery', sortOrder: 6 },
    { name: 'Pantry & Dry Goods', slug: 'pantry-dry-goods', sortOrder: 7 },
    { name: 'Frozen Foods', slug: 'frozen-foods', sortOrder: 8 },
    { name: 'Household & Cleaning', slug: 'household-cleaning', sortOrder: 9 },
    { name: 'Personal Care', slug: 'personal-care', sortOrder: 10 },
    { name: 'Baby Products', slug: 'baby-products', sortOrder: 11 },
    { name: 'Health & Wellness', slug: 'health-wellness', sortOrder: 12 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ ${categories.length} categories created`);

  // ── Supermarkets ────────────────────────────────────────
  const supermarkets = [
    {
      name: 'FreshMart', slug: 'freshmart',
      primaryColor: '#2E7D32',
      locations: [
        { address: '45 Main Street', city: 'Colombo', latitude: 6.9271, longitude: 79.8612, phone: '+94 11 234 5678' },
        { address: '12 Park Road', city: 'Kandy', latitude: 7.2906, longitude: 80.6337, phone: '+94 81 234 5678' },
      ],
    },
    {
      name: 'SuperSave', slug: 'supersave',
      primaryColor: '#1565C0',
      locations: [
        { address: '88 High Street', city: 'Colombo', latitude: 6.9344, longitude: 79.8428, phone: '+94 11 345 6789' },
        { address: '34 Temple Road', city: 'Galle', latitude: 6.0535, longitude: 80.2210, phone: '+94 91 345 6789' },
      ],
    },
    {
      name: 'ValuePlus', slug: 'valueplus',
      primaryColor: '#E65100',
      locations: [
        { address: '200 Galle Road', city: 'Colombo', latitude: 6.8935, longitude: 79.8561, phone: '+94 11 456 7890' },
        { address: '56 Peradeniya Road', city: 'Kandy', latitude: 7.2910, longitude: 80.6200, phone: '+94 81 456 7890' },
      ],
    },
    {
      name: 'EcoGrocer', slug: 'ecogrocer',
      primaryColor: '#6A1B9A',
      locations: [
        { address: '15 Union Place', city: 'Colombo', latitude: 6.9154, longitude: 79.8640, phone: '+94 11 567 8901' },
      ],
    },
  ];

  const supermarketMap = {};
  for (const sm of supermarkets) {
    const { locations, ...smData } = sm;
    const created = await prisma.supermarket.upsert({
      where: { slug: smData.slug },
      update: {},
      create: {
        ...smData,
        locations: {
          create: locations.map(l => ({ ...l, state: 'Western Province', postalCode: '00100' })),
        },
      },
    });
    supermarketMap[smData.slug] = created.id;
  }
  console.log(`✅ ${supermarkets.length} supermarkets created`);

  // ── Products ─────────────────────────────────────────────
  const fruitsCat = await prisma.category.findUnique({ where: { slug: 'fruits-vegetables' } });
  const dairyCat  = await prisma.category.findUnique({ where: { slug: 'dairy-eggs' } });
  const bakery    = await prisma.category.findUnique({ where: { slug: 'bakery-bread' } });
  const beverages = await prisma.category.findUnique({ where: { slug: 'beverages' } });
  const pantry    = await prisma.category.findUnique({ where: { slug: 'pantry-dry-goods' } });
  const household = await prisma.category.findUnique({ where: { slug: 'household-cleaning' } });
  const snacks    = await prisma.category.findUnique({ where: { slug: 'snacks-confectionery' } });

  const products = [
    { name: 'Whole Milk 1L',         slug: 'whole-milk-1l',       categoryId: dairyCat.id,  brand: 'Anchor',    defaultUnit: 'L' },
    { name: 'Fresh Eggs (12 pack)',   slug: 'fresh-eggs-12pack',   categoryId: dairyCat.id,  brand: 'Farm Fresh', defaultUnit: 'pack' },
    { name: 'Cheddar Cheese 500g',    slug: 'cheddar-cheese-500g', categoryId: dairyCat.id,  brand: 'Lakeland',  defaultUnit: 'g' },
    { name: 'Butter 500g',            slug: 'butter-500g',         categoryId: dairyCat.id,  brand: 'Anchor',    defaultUnit: 'g' },
    { name: 'Plain Yoghurt 400g',     slug: 'plain-yoghurt-400g',  categoryId: dairyCat.id,  brand: 'Curd Plus', defaultUnit: 'g' },
    { name: 'White Bread Loaf',       slug: 'white-bread-loaf',    categoryId: bakery.id,    brand: 'Sunrise',   defaultUnit: 'unit' },
    { name: 'Whole Wheat Bread',      slug: 'whole-wheat-bread',   categoryId: bakery.id,    brand: 'Sunrise',   defaultUnit: 'unit' },
    { name: 'Basmati Rice 5kg',       slug: 'basmati-rice-5kg',    categoryId: pantry.id,    brand: 'Royal',     defaultUnit: 'kg' },
    { name: 'Coconut Oil 500ml',      slug: 'coconut-oil-500ml',   categoryId: pantry.id,    brand: 'Coco',      defaultUnit: 'ml' },
    { name: 'Sugar 1kg',              slug: 'sugar-1kg',           categoryId: pantry.id,    brand: 'Lantic',    defaultUnit: 'kg' },
    { name: 'All-Purpose Flour 1kg',  slug: 'flour-1kg',           categoryId: pantry.id,    brand: 'Sun Gold',  defaultUnit: 'kg' },
    { name: 'Tomatoes (per kg)',       slug: 'tomatoes-per-kg',     categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Bananas (per kg)',        slug: 'bananas-per-kg',      categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Apples (per kg)',         slug: 'apples-per-kg',       categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Carrots (per kg)',        slug: 'carrots-per-kg',      categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Potatoes (per kg)',       slug: 'potatoes-per-kg',     categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Onions (per kg)',         slug: 'onions-per-kg',       categoryId: fruitsCat.id, defaultUnit: 'kg' },
    { name: 'Mineral Water 1.5L',      slug: 'mineral-water-1-5l',  categoryId: beverages.id, brand: 'Aqua',      defaultUnit: 'L' },
    { name: 'Orange Juice 1L',         slug: 'orange-juice-1l',     categoryId: beverages.id, brand: 'Tropicana', defaultUnit: 'L' },
    { name: 'Coca-Cola 2L',            slug: 'coca-cola-2l',        categoryId: beverages.id, brand: 'Coca-Cola', defaultUnit: 'L' },
    { name: 'Dishwashing Liquid 500ml',slug: 'dishwashing-500ml',   categoryId: household.id, brand: 'Sunlight',  defaultUnit: 'ml' },
    { name: 'Laundry Powder 2kg',      slug: 'laundry-powder-2kg',  categoryId: household.id, brand: 'Omo',       defaultUnit: 'kg' },
    { name: 'Toilet Paper 12 Rolls',   slug: 'toilet-paper-12',     categoryId: household.id, brand: 'Softly',    defaultUnit: 'pack' },
    { name: 'Potato Chips 150g',       slug: 'potato-chips-150g',   categoryId: snacks.id,    brand: "Lay's",     defaultUnit: 'g' },
    { name: 'Dark Chocolate 100g',     slug: 'dark-chocolate-100g', categoryId: snacks.id,    brand: 'Lindt',     defaultUnit: 'g' },
  ];

  const productMap = {};
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
    productMap[p.slug] = prod.id;
  }
  console.log(`✅ ${products.length} products created`);

  // ── Sample Prices ─────────────────────────────────────────
  const priceData = [
    // Milk 1L
    { productSlug: 'whole-milk-1l',       freshmart: 3.49, supersave: 3.29, valueplus: 3.59, ecogrocer: 3.69 },
    { productSlug: 'fresh-eggs-12pack',   freshmart: 5.99, supersave: 5.49, valueplus: 6.19, ecogrocer: 6.49 },
    { productSlug: 'cheddar-cheese-500g', freshmart: 8.99, supersave: 8.49, valueplus: 9.29, ecogrocer: 9.99 },
    { productSlug: 'butter-500g',         freshmart: 6.49, supersave: 5.99, valueplus: 6.79, ecogrocer: 7.49 },
    { productSlug: 'plain-yoghurt-400g',  freshmart: 3.29, supersave: 2.99, valueplus: 3.49, ecogrocer: 3.79 },
    { productSlug: 'white-bread-loaf',    freshmart: 2.49, supersave: 2.29, valueplus: 2.59, ecogrocer: 2.99 },
    { productSlug: 'whole-wheat-bread',   freshmart: 2.99, supersave: 2.79, valueplus: 3.19, ecogrocer: 3.49 },
    { productSlug: 'basmati-rice-5kg',    freshmart: 14.99, supersave: 13.49, valueplus: 15.49, ecogrocer: 16.99 },
    { productSlug: 'coconut-oil-500ml',   freshmart: 7.99, supersave: 7.49, valueplus: 8.29, ecogrocer: 8.99 },
    { productSlug: 'sugar-1kg',           freshmart: 2.99, supersave: 2.79, valueplus: 3.09, ecogrocer: 3.29 },
    { productSlug: 'flour-1kg',           freshmart: 2.49, supersave: 2.19, valueplus: 2.59, ecogrocer: 2.79 },
    { productSlug: 'tomatoes-per-kg',     freshmart: 3.99, supersave: 3.49, valueplus: 4.19, ecogrocer: 4.49 },
    { productSlug: 'bananas-per-kg',      freshmart: 2.99, supersave: 2.79, valueplus: 3.09, ecogrocer: 3.29 },
    { productSlug: 'apples-per-kg',       freshmart: 5.49, supersave: 4.99, valueplus: 5.79, ecogrocer: 6.29 },
    { productSlug: 'carrots-per-kg',      freshmart: 2.49, supersave: 2.19, valueplus: 2.59, ecogrocer: 2.79 },
    { productSlug: 'potatoes-per-kg',     freshmart: 2.29, supersave: 1.99, valueplus: 2.39, ecogrocer: 2.59 },
    { productSlug: 'onions-per-kg',       freshmart: 1.99, supersave: 1.79, valueplus: 2.09, ecogrocer: 2.29 },
    { productSlug: 'mineral-water-1-5l',  freshmart: 1.29, supersave: 0.99, valueplus: 1.39, ecogrocer: 1.49 },
    { productSlug: 'orange-juice-1l',     freshmart: 4.99, supersave: 4.49, valueplus: 5.19, ecogrocer: 5.99 },
    { productSlug: 'coca-cola-2l',        freshmart: 3.49, supersave: 3.19, valueplus: 3.69, ecogrocer: 3.89 },
    { productSlug: 'dishwashing-500ml',   freshmart: 3.99, supersave: 3.49, valueplus: 4.19, ecogrocer: 4.49 },
    { productSlug: 'laundry-powder-2kg',  freshmart: 12.99, supersave: 11.49, valueplus: 13.49, ecogrocer: 14.99 },
    { productSlug: 'toilet-paper-12',     freshmart: 9.99, supersave: 8.99, valueplus: 10.49, ecogrocer: 11.99 },
    { productSlug: 'potato-chips-150g',   freshmart: 2.99, supersave: 2.79, valueplus: 3.09, ecogrocer: 3.29 },
    { productSlug: 'dark-chocolate-100g', freshmart: 4.49, supersave: 3.99, valueplus: 4.69, ecogrocer: 5.49 },
  ];

  let priceCount = 0;
  const smKeys = ['freshmart', 'supersave', 'valueplus', 'ecogrocer'];

  for (const row of priceData) {
    const productId = productMap[row.productSlug];
    if (!productId) continue;

    for (const smKey of smKeys) {
      if (row[smKey] !== undefined) {
        await prisma.price.create({
          data: {
            productId,
            supermarketId: supermarketMap[smKey],
            price: row[smKey],
            unit: 'unit',
            isVerified: true,
            source: 'manual',
          },
        });
        priceCount++;

        // Add some historical price data (3 months back)
        for (let i = 1; i <= 6; i++) {
          const histDate = new Date();
          histDate.setDate(histDate.getDate() - i * 14);
          const variation = (Math.random() - 0.5) * 0.4;
          await prisma.price.create({
            data: {
              productId,
              supermarketId: supermarketMap[smKey],
              price: Math.max(0.5, row[smKey] + variation),
              unit: 'unit',
              isVerified: true,
              source: 'manual',
              recordedAt: histDate,
            },
          });
          priceCount++;
        }
      }
    }
  }
  console.log(`✅ ${priceCount} price records created`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('─────────────────────────────────────');
  console.log(`Admin: ${process.env.ADMIN_EMAIL || 'admin@pricewise.com'} / Admin@123`);
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
