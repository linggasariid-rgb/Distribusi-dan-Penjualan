import { BASE_URL } from '../config/config.js';
import { READ, WRITE, BERANDA } from '../config/routes.js';

// Promise-based replacement for the old google.script.run -> fetch() bridge.
// Same URL/param/body construction and same error check as the original.
export function callApi(name, ...args) {
  return new Promise((resolve, reject) => {
    let url = BASE_URL;
    let method = 'GET';
    let body = null;

    if (BERANDA.indexOf(name) >= 0) {
      url += '/api/beranda';
      if (name === 'getSalesDashboardData') {
        const bq = [];
        if (args[2]) bq.push('whp=' + encodeURIComponent(args[2]));
        if (args[0] && args[0] !== 'ALL') bq.push('selWhp=' + encodeURIComponent(args[0]));
        if (args[1] && args[1] !== 'ALL') bq.push('branch=' + encodeURIComponent(args[1]));
        if (bq.length) url += '?' + bq.join('&');
      }
    } else if (READ[name]) {
      const e = READ[name];
      url += e.url;
      const q = [];
      for (let i = 0; i < e.params.length; i++) {
        if (i < args.length && args[i] != null && args[i] !== '') {
          q.push(encodeURIComponent(e.params[i]) + '=' + encodeURIComponent(args[i]));
        }
      }
      if (q.length) url += '?' + q.join('&');
    } else if (WRITE[name]) {
      const w = WRITE[name];
      url += w.url;
      method = 'POST';
      const obj = {};
      for (let i = 0; i < w.params.length; i++) {
        if (i < args.length) obj[w.params[i]] = args[i];
      }
      body = JSON.stringify(obj);
    } else {
      reject(new Error('Unknown: ' + name));
      return;
    }

    const opts = { method };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = body;
    }

    fetch(url, opts)
      .then(r => r.json())
      .then(d => {
        if (d && (d.error || d.status === 'error')) reject(new Error(d.message || d.error));
        else resolve(d);
      })
      .catch(err => reject(err));
  });
}
