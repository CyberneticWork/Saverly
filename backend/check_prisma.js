const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const total = await prisma.invoice.count();
    const groups = await prisma.invoice.groupBy({
      by: ["status"],
      _count: { status: true }
    });
    console.log("Total Invoices:", total);
    groups.forEach(g => console.log(g.status + ":", g._count.status));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
