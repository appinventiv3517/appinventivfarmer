/*
 * Plugin UI: shows what will be built, then streams screens and their
 * assets to the main thread one message at a time (each is acknowledged).
 */
(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('ku-data').textContent);
  var $ = function (id) {
    return document.getElementById(id);
  };
  var seq = 0;
  var waiting = {};
  var cancelled = false;
  var running = false;

  window.onmessage = function (ev) {
    var msg = ev.data && ev.data.pluginMessage;
    if (!msg || msg.type !== 'ack') return;
    var w = waiting[msg.seq];
    if (!w) return;
    delete waiting[msg.seq];
    if (msg.ok) w.resolve(msg);
    else w.reject(new Error(msg.error || 'Unknown error'));
  };

  function send(type, payload, transfer) {
    var id = ++seq;
    var msg = Object.assign({ type: type, seq: id }, payload || {});
    return new Promise(function (resolve, reject) {
      waiting[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ pluginMessage: msg }, '*', transfer || []);
    });
  }

  /* ---------- page list ---------- */

  var pageEl = $('pages');
  var counts = {};
  DATA.screens.forEach(function (s) {
    counts[s.page] = (counts[s.page] || 0) + 1;
  });
  DATA.pages.forEach(function (p) {
    var li = document.createElement('li');
    var n = counts[p.title] || 0;
    li.innerHTML =
      '<label><input type="checkbox" checked data-page="' +
      escapeHtml(p.title) +
      '" /> <span>' +
      escapeHtml(p.title) +
      (p.note ? ' <small>· ' + escapeHtml(p.note) + '</small>' : '') +
      '</span><span class="count">' +
      (n ? n + (n === 1 ? ' frame' : ' frames') : '') +
      '</span></label>';
    pageEl.appendChild(li);
  });
  $('summary').textContent = DATA.screens.length + ' screens & states · ' + DATA.pages.length + ' pages · captured ' + DATA.generated.slice(0, 10);
  $('build').disabled = false;

  $('all').onclick = function () {
    setAll(true);
  };
  $('none').onclick = function () {
    setAll(false);
  };
  function setAll(v) {
    pageEl.querySelectorAll('input').forEach(function (i) {
      i.checked = v;
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- helpers ---------- */

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function assetRefs(root) {
    var refs = [];
    (function walk(n) {
      if (n.fills)
        n.fills.forEach(function (f) {
          if (f.k === 'I' && f.ref) refs.push(f.ref);
        });
      if (n.t === 'V') {
        if (n.ref) refs.push(n.ref);
        if (n.png) refs.push(n.png);
      }
      if (n.c) n.c.forEach(walk);
    })(root);
    return refs;
  }

  var sent = {};
  async function sendAssets(ids) {
    var items = [];
    var transfer = [];
    var bytes = 0;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (sent[id]) continue;
      var a = DATA.assets[id];
      if (!a) {
        log('Missing asset ' + id, 'err');
        continue;
      }
      sent[id] = true;
      if (a.kind === 'svg') {
        items.push({ id: id, kind: 'svg', text: a.text });
        bytes += a.text.length;
      } else {
        var arr = b64ToBytes(a.b64);
        items.push({ id: id, kind: a.kind, bytes: arr });
        bytes += arr.length;
      }
      if (bytes > 4e6) {
        await send('assets', { items: items });
        items = [];
        bytes = 0;
      }
    }
    if (items.length) await send('assets', { items: items });
  }

  function log(text, cls) {
    var li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    var el = $('log');
    el.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }
  function progress(done, total, text) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    $('bar').style.width = pct + '%';
    document.querySelector('.progress').setAttribute('aria-valuenow', String(pct));
    if (text) $('status').textContent = text;
  }

  /* ---------- build ---------- */

  $('build').onclick = async function () {
    if (running) return;
    var chosen = [];
    pageEl.querySelectorAll('input:checked').forEach(function (i) {
      chosen.push(i.getAttribute('data-page'));
    });
    if (!chosen.length) {
      $('summary').textContent = 'Choose at least one page.';
      return;
    }
    running = true;
    cancelled = false;
    $('setup').hidden = true;
    $('run').hidden = false;
    $('build').disabled = true;
    $('cancel').textContent = 'Stop';

    var opts = {
      bindTokens: $('opt-bind').checked,
      components: $('opt-components').checked,
      prototype: $('opt-proto').checked,
      bitmapIllustrations: $('opt-bitmap').checked,
      replace: $('opt-replace').checked,
      foundations: chosen.indexOf('Foundations') >= 0,
    };
    var pages = DATA.pages
      .map(function (p) {
        return p.title;
      })
      .filter(function (t) {
        return chosen.indexOf(t) >= 0 || t === 'Components';
      });
    var screens = DATA.screens.filter(function (s) {
      return chosen.indexOf(s.page) >= 0;
    });
    var t0 = Date.now();
    var failed = 0;
    try {
      progress(0, screens.length + 2, 'Loading fonts, creating pages and foundations…');
      var started = await send('start', { opts: opts, tokens: DATA.tokens, pages: pages });
      log('Font: ' + started.family + ' (' + started.styles + ' styles)');
      if (DATA.logo) await sendAssets([DATA.logo.id]);
      for (var i = 0; i < screens.length; i++) {
        if (cancelled) break;
        var s = screens[i];
        progress(i + 1, screens.length + 2, s.page + ' · ' + s.name);
        try {
          await sendAssets(assetRefs(s.root));
          var res = await send('screen', { rec: s.rec, root: s.root });
          log('✓ ' + s.name + '  (' + res.nodes + ' layers)');
          (res.warnings || []).forEach(function (w) {
            log('  · ' + w, 'err');
          });
        } catch (e) {
          failed++;
          log('✕ ' + s.name + ': ' + e.message, 'err');
        }
      }
      progress(screens.length + 1, screens.length + 2, 'Wiring prototype links and components…');
      var pageIndex = pages.map(function (t) {
        return { title: t, count: counts[t] || 0 };
      });
      var done = await send('finish', {
        logo: DATA.logo ? DATA.logo.id : null,
        logoRatio: DATA.logo ? DATA.logo.ratio : 1,
        stats: { screens: screens.length - failed, pages: pages.length },
        pageIndex: pageIndex,
      });
      progress(1, 1, (cancelled ? 'Stopped. ' : 'Done. ') + done.screens + ' screens in ' + Math.round((Date.now() - t0) / 1000) + 's');
      log(done.nodes + ' layers · ' + done.icons + ' icon components · ' + done.componentSets + ' component sets · ' + done.links + ' prototype links', 'ok');
      if (done.removedPages) log('Replaced ' + done.removedPages + ' pages from the earlier import.');
      if (failed) log(failed + ' screens failed (see above).', 'err');
      if (done.warnings && done.warnings.length) {
        log(done.warnings.length + ' notes:', 'err');
        done.warnings.slice(0, 60).forEach(function (w) {
          log('  · ' + w, 'err');
        });
      }
    } catch (e) {
      log('Build stopped: ' + e.message, 'err');
      $('status').textContent = 'Something went wrong.';
    }
    running = false;
    $('cancel').textContent = 'Close';
  };

  $('cancel').onclick = function () {
    if (running) {
      cancelled = true;
      $('status').textContent = 'Stopping after this screen…';
      return;
    }
    parent.postMessage({ pluginMessage: { type: 'close', seq: ++seq } }, '*');
  };

  parent.postMessage({ pluginMessage: { type: 'hello', seq: ++seq } }, '*');
})();
