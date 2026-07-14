import { Supabase } from './supabase.js';
import { CONFIG } from './config.js';
import * as beranda from './routes/beranda.js';
import * as salesHub from './routes/sales-hub.js';
import * as salesReport from './routes/sales-report.js';
import * as bestProducts from './routes/best-products.js';
import * as controlPoint from './routes/control-point.js';
import * as distribution from './routes/distribution.js';
import * as savePenerimaanPabrik from './routes/save-penerimaan-pabrik.js';
import * as saveDistribusi from './routes/save-distribusi.js';
import * as savePenjualanWho from './routes/save-penjualan-who.js';
import * as saveBiz from './routes/save-biz.js';
import * as saveStock from './routes/save-stock.js';
import * as chat from './routes/chat.js';
import * as login from './routes/login.js';
import * as inputHistory from './routes/input-history.js';
import * as deleteBatch from './routes/delete-batch.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function error(msg, status = 400) {
  return json({ status: 'error', message: msg }, status);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = new Supabase(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    try {
      if (path === '/api/beranda' || path === '/api/beranda/') {
        const whp = url.searchParams.get('whp') || '';
        const selWhp = url.searchParams.get('selWhp') || '';
        const branch = url.searchParams.get('branch') || '';
        return json(await beranda.handle(db, whp, selWhp, branch));
      }

      if (path === '/api/sales-hub' || path === '/api/sales-hub/') {
        const whp = url.searchParams.get('whp') || '';
        const currDate = url.searchParams.get('currDate') || '';
        const prevDate = url.searchParams.get('prevDate') || '';
        const backDate = url.searchParams.get('backDate') || '';
        return json(await salesHub.handle(db, whp, currDate, prevDate, backDate));
      }

      if (path === '/api/sales-report' || path === '/api/sales-report/') {
        const dayFilter = parseInt(url.searchParams.get('dayFilter') || '-1');
        const filterMonth = url.searchParams.get('filterMonth') || '';
        const startMonth = url.searchParams.get('startMonth') || '';
        const whp = url.searchParams.get('whp') || '';
        return json(await salesReport.handle(db, dayFilter, filterMonth, startMonth, whp));
      }

      if (path === '/api/best-products/months') {
        return json(await bestProducts.months(db));
      }

      if (path === '/api/best-products/data') {
        const month = url.searchParams.get('month') || '';
        return json(await bestProducts.data(db, month));
      }

      if (path === '/api/control-point') {
        return json(await controlPoint.handle(db));
      }

      if (path === '/api/distribution') {
        const whp = url.searchParams.get('whp') || '';
        return json(await distribution.handle(db, whp));
      }

      if (path === '/api/input-history') {
        const table = url.searchParams.get('table') || '';
        return json(await inputHistory.handle(db, table));
      }

      if (path === '/api/login' || path === '/api/login/') {
        if (request.method !== 'POST') return error('Method not allowed', 405);
        const body = await request.json();
        return json(await login.handle(body));
      }

      // ──── WRITE APIs ────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();

        if (path === '/api/save/penerimaan-pabrik') {
          return json(await savePenerimaanPabrik.handle(db, body));
        }
        if (path === '/api/save/distribusi') {
          return json(await saveDistribusi.handle(db, body));
        }
        if (path === '/api/save/penjualan-who') {
          return json(await savePenjualanWho.handle(db, body));
        }
        if (path === '/api/save/biz') {
          return json(await saveBiz.handle(db, body));
        }
        if (path === '/api/save/stock') {
          return json(await saveStock.handle(db, body));
        }
        if (path === '/api/chat') {
          return json(await chat.handle(env, body));
        }
        if (path === '/api/delete-batch') {
          return json(await deleteBatch.handle(db, body));
        }

        return json({ status: 'error', message: 'Not found' }, 404);
      }

      return json({ status: 'error', message: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return error(err.message, 500);
    }
  },
};
