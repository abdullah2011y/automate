import { PrismaClient, Role, OrderConfirmationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or update Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'byteforge-demo' },
    update: {},
    create: {
      name: 'ByteForge Demo Store',
      slug: 'byteforge-demo',
      subdomain: 'demo',
      currency: 'USD',
      timezone: 'UTC',
    },
  });

  console.log(`🏢 Tenant established: ${tenant.name} (${tenant.id})`);

  // 2. Create or update Admin User
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@byteforge.io' },
    update: {
      passwordHash,
    },
    create: {
      tenantId: tenant.id,
      email: 'admin@byteforge.io',
      name: 'Abdullah Admin',
      passwordHash,
      role: Role.OWNER,
    },
  });

  console.log(`👤 Admin user established: ${user.email} (${user.role})`);

  // 3. Create Sample Customers
  const customerData = [
    {
      firstName: 'Zainab',
      lastName: 'Ahmed',
      phoneNumber: '+923001234567',
      email: 'zainab.ahmed@example.com',
    },
    {
      firstName: 'Hamza',
      lastName: 'Malik',
      phoneNumber: '+923219876543',
      email: 'hamza.malik@example.com',
    },
    {
      firstName: 'Fatima',
      lastName: 'Noor',
      phoneNumber: '+923334567890',
      email: 'fatima.noor@example.com',
    },
    {
      firstName: 'Bilal',
      lastName: 'Khan',
      phoneNumber: '+923455678901',
      email: 'bilal.khan@example.com',
    },
    {
      firstName: 'Ayesha',
      lastName: 'Siddiqui',
      phoneNumber: '+923122345678',
      email: 'ayesha.siddiqui@example.com',
    },
  ];

  const createdCustomers: any[] = [];
  for (const c of customerData) {
    const cust = await prisma.customer.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: tenant.id,
          phoneNumber: c.phoneNumber,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber,
        email: c.email,
        totalOrders: 1,
        totalSpent: 75.0,
      },
    });
    createdCustomers.push(cust);
  }

  console.log(`👥 Created ${createdCustomers.length} sample customers.`);

  // 4. Create Sample Orders
  const sampleOrders = [
    {
      shopifyOrderId: 'gid://shopify/Order/6012401',
      shopifyOrderNumber: '#1089',
      customerIndex: 0,
      totalPrice: '48.50',
      subtotalPrice: '45.00',
      status: OrderConfirmationStatus.CONFIRMED,
      confirmedAt: new Date(Date.now() - 15 * 60 * 1000),
      items: [
        { title: 'Velvet Matte Lipstick (Ruby Red)', sku: 'LIP-RUBY-01', quantity: 1, unitPrice: '25.00' },
        { title: 'Hydrating Face Mist 100ml', sku: 'SKIN-MIST-02', quantity: 1, unitPrice: '20.00' },
      ],
    },
    {
      shopifyOrderId: 'gid://shopify/Order/6012402',
      shopifyOrderNumber: '#1088',
      customerIndex: 1,
      totalPrice: '112.00',
      subtotalPrice: '110.00',
      status: OrderConfirmationStatus.PENDING_CONFIRMATION,
      items: [
        { title: 'Silk Glow Foundation (#03 Warm Honey)', sku: 'FDN-WH-03', quantity: 2, unitPrice: '45.00' },
        { title: 'Beauty Blending Sponge Duo', sku: 'TOOL-SPONGE-01', quantity: 1, unitPrice: '20.00' },
      ],
    },
    {
      shopifyOrderId: 'gid://shopify/Order/6012403',
      shopifyOrderNumber: '#1087',
      customerIndex: 2,
      totalPrice: '35.00',
      subtotalPrice: '35.00',
      status: OrderConfirmationStatus.CANCELLED,
      cancelledAt: new Date(Date.now() - 45 * 60 * 1000),
      cancellationReason: 'Customer requested cancellation via WhatsApp (Ordered by mistake)',
      items: [
        { title: 'Vitamin C Brightening Serum 30ml', sku: 'SERUM-VITC-01', quantity: 1, unitPrice: '35.00' },
      ],
    },
    {
      shopifyOrderId: 'gid://shopify/Order/6012404',
      shopifyOrderNumber: '#1086',
      customerIndex: 3,
      totalPrice: '89.90',
      subtotalPrice: '85.00',
      status: OrderConfirmationStatus.CONFIRMED,
      confirmedAt: new Date(Date.now() - 90 * 60 * 1000),
      items: [
        { title: 'Charcoal Deep Cleansing Gel', sku: 'CLN-CHAR-01', quantity: 2, unitPrice: '30.00' },
        { title: 'Soothing Aloe Gel 250ml', sku: 'ALOE-GEL-02', quantity: 1, unitPrice: '25.00' },
      ],
    },
    {
      shopifyOrderId: 'gid://shopify/Order/6012405',
      shopifyOrderNumber: '#1085',
      customerIndex: 4,
      totalPrice: '140.20',
      subtotalPrice: '135.00',
      status: OrderConfirmationStatus.PROCESSING,
      confirmedAt: new Date(Date.now() - 180 * 60 * 1000),
      items: [
        { title: 'Night Renewal Retinol Creme', sku: 'RET-NIGHT-01', quantity: 1, unitPrice: '75.00' },
        { title: 'Peptide Firming Eye Cream', sku: 'EYE-PEP-02', quantity: 1, unitPrice: '60.00' },
      ],
    },
  ];

  for (const ord of sampleOrders) {
    const customer = createdCustomers[ord.customerIndex];

    const order = await prisma.order.upsert({
      where: {
        tenantId_shopifyOrderId: {
          tenantId: tenant.id,
          shopifyOrderId: ord.shopifyOrderId,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        customerId: customer.id,
        shopifyOrderId: ord.shopifyOrderId,
        shopifyOrderNumber: ord.shopifyOrderNumber,
        currency: 'USD',
        totalPrice: ord.totalPrice,
        subtotalPrice: ord.subtotalPrice,
        totalDiscounts: '0.00',
        paymentGateway: 'cash_on_delivery',
        confirmationStatus: ord.status,
        confirmedAt: ord.confirmedAt,
        cancelledAt: ord.cancelledAt,
        cancellationReason: ord.cancellationReason,
        shippingAddress: {
          city: 'Lahore',
          country: 'Pakistan',
          address1: 'Street 4, Sector Y, DHA Phase 3',
        },
        items: {
          create: ord.items.map((i) => ({
            title: i.title,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });

    // Create Audit Log for non-pending orders
    if (ord.status === OrderConfirmationStatus.CONFIRMED) {
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          orderId: order.id,
          userId: user.id,
          action: 'ORDER_CONFIRMED',
          details: { method: 'WHATSAPP_INTERACTIVE_BUTTON', confirmedBy: customer.phoneNumber },
        },
      });
    } else if (ord.status === OrderConfirmationStatus.CANCELLED) {
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          orderId: order.id,
          userId: user.id,
          action: 'ORDER_CANCELLED',
          details: { method: 'WHATSAPP_INTERACTIVE_BUTTON', reason: ord.cancellationReason },
        },
      });
    }
  }

  console.log('✅ Seed completed successfully with realistic orders, items, and audit logs!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
