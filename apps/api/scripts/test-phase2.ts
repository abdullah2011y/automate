import assert from 'assert';

const API_BASE = 'http://localhost:5000/api/v1';

async function testSuite() {
  console.log('🧪 Starting Phase 2 End-to-End Verification Test Suite...\n');

  // 1. Health Endpoint
  console.log('1️⃣ Testing GET /health...');
  const healthRes = await fetch(`${API_BASE}/health`);
  assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
  const healthJson = await healthRes.json();
  assert.strictEqual(healthJson.status, 'ok');
  console.log('   ✅ Health endpoint OK:', healthJson.status, `(Uptime: ${healthJson.uptimeSeconds}s)`);

  // 2. Auth: Login
  console.log('\n2️⃣ Testing POST /auth/login (Admin credentials)...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@byteforge.io', password: 'Password123!' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Login should succeed with 200');
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const tenantId = loginJson.data.tenant.id;
  assert(token, 'Token must be present in response');
  assert.strictEqual(loginJson.data.user.role, 'OWNER');
  console.log('   ✅ Login successful for:', loginJson.data.user.email);
  console.log('   🏢 Tenant isolated to:', loginJson.data.tenant.name, `(${tenantId})`);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. Auth: GET /me
  console.log('\n3️⃣ Testing GET /auth/me...');
  const meRes = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders });
  assert.strictEqual(meRes.status, 200);
  const meJson = await meRes.json();
  assert.strictEqual(meJson.data.user.email, 'admin@byteforge.io');
  assert.strictEqual(meJson.data.tenant.id, tenantId);
  console.log('   ✅ Verified /auth/me for user:', meJson.data.user.name);

  // 4. Analytics Overview
  console.log('\n4️⃣ Testing GET /analytics/overview...');
  const analyticsRes = await fetch(`${API_BASE}/analytics/overview`, { headers: authHeaders });
  assert.strictEqual(analyticsRes.status, 200);
  const analyticsJson = await analyticsRes.json();
  const summary = analyticsJson.data.summary;
  assert(typeof summary.totalOrders === 'number');
  assert(summary.totalOrders > 0, 'Total orders should be greater than 0');
  console.log('   ✅ Analytics overview metrics from PostgreSQL:');
  console.log('      - Total Orders:', summary.totalOrders);
  console.log('      - Pending:', summary.pendingConfirmation);
  console.log('      - Confirmed:', summary.confirmed);
  console.log('      - Cancelled:', summary.cancelled);
  console.log('      - Confirmation Rate:', summary.confirmationRate);
  console.log('      - Confirmed GMV:', summary.confirmedTotalValue);
  console.log('      - Freight Savings:', summary.savedFromReturnsValue);

  // 5. Orders: List and Filters
  console.log('\n5️⃣ Testing GET /orders with pagination and status filter...');
  const ordersRes = await fetch(`${API_BASE}/orders?page=1&limit=5`, { headers: authHeaders });
  assert.strictEqual(ordersRes.status, 200);
  const ordersJson = await ordersRes.json();
  assert(ordersJson.data.orders.length > 0, 'Should return order list');
  const firstOrder = ordersJson.data.orders[0];
  console.log(`   ✅ Orders fetched (${ordersJson.data.orders.length} items on page 1 of ${ordersJson.data.pagination.totalPages})`);
  console.log(`      First Order: ${firstOrder.shopifyOrderNumber} - Customer: ${firstOrder.customer.firstName} - Amount: $${firstOrder.totalPrice}`);

  // Test status filter
  const confirmedRes = await fetch(`${API_BASE}/orders?status=CONFIRMED`, { headers: authHeaders });
  const confirmedJson = await confirmedRes.json();
  for (const o of confirmedJson.data.orders) {
    assert.strictEqual(o.confirmationStatus, 'CONFIRMED', 'All filtered orders must have status CONFIRMED');
  }
  console.log(`   ✅ Status filter verified (${confirmedJson.data.orders.length} CONFIRMED orders found)`);

  // 6. Orders: Create Order Manually
  console.log('\n6️⃣ Testing POST /orders (Creating new COD Order)...');
  const createOrderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerName: 'Khadija Tariq',
      customerPhone: '+923019876543',
      shopifyOrderNumber: `#TEST-${Date.now().toString().slice(-4)}`,
      totalPrice: 65.50,
      shippingAddress: { city: 'Islamabad', country: 'Pakistan', address1: 'House 12, F-7/2' },
      items: [
        { title: 'Rosewater Balancing Toner', sku: 'TONER-RW-01', quantity: 1, unitPrice: 35.50 },
        { title: 'Purifying Clay Mask', sku: 'MASK-CLAY-02', quantity: 1, unitPrice: 30.00 },
      ],
    }),
  });
  assert.strictEqual(createOrderRes.status, 201, 'Order creation should return 201 Created');
  const newOrderJson = await createOrderRes.json();
  const createdOrderId = newOrderJson.data.id;
  assert.strictEqual(newOrderJson.data.confirmationStatus, 'PENDING_CONFIRMATION');
  console.log('   ✅ Order created successfully:', newOrderJson.data.shopifyOrderNumber, `(ID: ${createdOrderId})`);

  // 7. Orders: Status Update & Audit Log
  console.log('\n7️⃣ Testing PATCH /orders/:id/status (Updating to CONFIRMED with note)...');
  const updateRes = await fetch(`${API_BASE}/orders/${createdOrderId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'CONFIRMED',
      note: 'Verified address with customer on phone',
    }),
  });
  assert.strictEqual(updateRes.status, 200);
  const updatedJson = await updateRes.json();
  assert.strictEqual(updatedJson.data.confirmationStatus, 'CONFIRMED');
  assert(updatedJson.data.confirmedAt, 'confirmedAt timestamp must be set');
  console.log('   ✅ Order status successfully updated to CONFIRMED');

  // Verify Audit Log
  const detailsRes = await fetch(`${API_BASE}/orders/${createdOrderId}`, { headers: authHeaders });
  const detailsJson = await detailsRes.json();
  assert(detailsJson.data.auditLogs.length > 0, 'Audit log must record the status update');
  const lastLog = detailsJson.data.auditLogs[0];
  assert.strictEqual(lastLog.action, 'ORDER_STATUS_MANUAL_UPDATE');
  assert.strictEqual(lastLog.details.newStatus, 'CONFIRMED');
  console.log('   ✅ Audit Log entry verified:', lastLog.action, `by ${lastLog.details.updatedByEmail}`);

  // 8. Tenant Isolation Security Test
  console.log('\n8️⃣ Testing Multi-Tenant Isolation Security...');
  const signupTenantB = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeName: 'Isolated Boutique ' + Date.now(),
      name: 'Owner B',
      email: `owner.b.${Date.now()}@tenant-isolation-test.com`,
      password: 'SecurePassword123!',
    }),
  });
  assert.strictEqual(signupTenantB.status, 201);
  const tenantBJson = await signupTenantB.json();
  const tokenB = tenantBJson.data.token;
  const tenantBId = tenantBJson.data.tenant.id;

  const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // Tenant B queries orders (must be empty)
  const ordersBRes = await fetch(`${API_BASE}/orders`, { headers: headersB });
  const ordersBJson = await ordersBRes.json();
  assert.strictEqual(ordersBJson.data.orders.length, 0, 'Tenant B must see 0 orders');

  // Tenant B attempts to access Tenant A's order by ID (must be blocked with 404)
  const crossTenantRes = await fetch(`${API_BASE}/orders/${createdOrderId}`, { headers: headersB });
  assert.strictEqual(crossTenantRes.status, 404, 'Cross-tenant order access must return 404 Not Found');

  console.log('   ✅ Tenant Isolation successfully verified:');
  console.log('      - Tenant B order count: 0');
  console.log('      - Cross-tenant access attempt: Blocked (HTTP 404 Not Found)');

  console.log('\n🎉 ALL PHASE 2 TESTS PASSED WITH 100% SUCCESS!\n');
}

testSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
