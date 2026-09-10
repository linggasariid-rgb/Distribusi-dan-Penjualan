export async function handle(db, reqMethod, body) {
  if (reqMethod === 'GET') {
    const rows = await db.query('product_prices', {
      select: 'product_name,price_mst,price_stk',
      order: 'product_name.asc'
    });
    return { status: 'success', data: rows };
  }

  if (reqMethod === 'POST') {
    const prices = body.prices; // Expect array of { product_name, price_mst, price_stk }
    if (!Array.isArray(prices)) {
      return { status: 'error', message: 'Invalid data format' };
    }

    // Process all updates in parallel
    const promises = prices.map(p => {
      return db.request('POST', 'product_prices', {
        data: {
          product_name: p.product_name,
          price_mst: p.price_mst || 0,
          price_stk: p.price_stk || 0,
          updated_at: new Date().toISOString()
        },
        onConflict: 'product_name'
      });
    });

    await Promise.all(promises);
    return { status: 'success', message: 'Harga berhasil diperbarui' };
  }

  return { status: 'error', message: 'Method not allowed' };
}
