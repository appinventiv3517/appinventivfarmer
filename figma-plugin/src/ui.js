/*
 * Plugin UI: holds the data pack, shows import options and progress, and
 * answers the main thread's requests for screens, images and SVGs.
 */
(function () {
  'use strict';

  var pack = null; // { manifest, screens, components, foundations, svgs }
  var images = {}; // key -> base64
  var $ = function (id) {
    return document.getElementById(id);
  };
  var selectedGroups = {};

  function post(msg) {
    parent.postMessage({ pluginMessage: msg }, '*');
  }

  function addLog(level, text) {
    var li = document.createElement('li');
    li.className = level;
    li.textContent = text;
    $('log').appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- Loading the pack ---------- */

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function inflate(b64) {
    var text = b64.trim();
    if (!text || text.indexOf('/*__') === 0) throw new Error('This ui.html has no data pack. Run "node tools/build.mjs" in the plugin folder.');
    if (text.charAt(0) === '{') return JSON.parse(text); // uncompressed pack
    if (typeof DecompressionStream === 'undefined') throw new Error('This Figma version cannot unpack the data (no DecompressionStream). Update Figma, or rebuild with "node tools/build.mjs --raw".');
    var stream = new Blob([b64ToBytes(text)]).stream().pipeThrough(new DecompressionStream('gzip'));
    var json = await new Response(stream).text();
    return JSON.parse(json);
  }

  async function load() {
    try {
      pack = await inflate($('pack').textContent);
      var imgText = $('pack-images').textContent.trim();
      images = imgText && imgText.indexOf('/*__') !== 0 ? JSON.parse(imgText) : {};
      if (images.logo) $('logo').src = 'data:image/png;base64,' + images.logo;
      renderSetup();
    } catch (e) {
      $('summary').innerHTML = '';
      var p = document.createElement('p');
      p.className = 'muted';
      p.style.color = 'var(--bad)';
      p.textContent = 'Could not read the data pack: ' + e.message;
      $('summary').appendChild(p);
    }
  }

  /* ---------- Setup screen ---------- */

  function renderSetup() {
    var m = pack.manifest;
    $('captured').textContent = m.app + ' · captured ' + m.capturedAt;
    var total = m.screens.length;
    var routes = m.screens.filter(function (s) {
      return s.primary;
    }).length;
    var comps = 0;
    Object.keys(pack.components).forEach(function (d) {
      comps += pack.components[d].length;
    });
    $('summary').innerHTML =
      '<div class="stats">' +
      '<div class="stat"><b>' + routes + '</b><span>screens</span></div>' +
      '<div class="stat"><b>' + (total - routes) + '</b><span>more states and flow steps</span></div>' +
      '<div class="stat"><b>' + comps + '</b><span>component variants</span></div>' +
      '</div>';

    var dirs = $('dirs');
    dirs.innerHTML = '';
    m.directions.forEach(function (d) {
      var c = m.counts[d.id] || {};
      var label = document.createElement('label');
      label.innerHTML = '<input type="checkbox" data-dir="' + d.id + '" checked /> <span><b>' + d.title + '</b> · ' + (c.routes || 0) + ' screens, ' + ((c.screens || 0) - (c.routes || 0)) + ' states, ' + (c.sets || 0) + ' component sets</span>';
      dirs.appendChild(label);
    });

    var groups = [];
    m.screens.forEach(function (s) {
      if (groups.indexOf(s.group) < 0) groups.push(s.group);
    });
    var box = $('groups');
    box.innerHTML = '';
    groups.forEach(function (g) {
      selectedGroups[g] = true;
      var n = m.screens.filter(function (s) {
        return s.group === g;
      }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = g + ' <small>' + n + '</small>';
      b.onclick = function () {
        selectedGroups[g] = !selectedGroups[g];
        b.setAttribute('aria-pressed', String(selectedGroups[g]));
        updateEstimate();
      };
      box.appendChild(b);
    });
    $('all-groups').onclick = function () {
      var all = Object.keys(selectedGroups).every(function (g) {
        return selectedGroups[g];
      });
      Array.prototype.forEach.call(box.children, function (b, i) {
        selectedGroups[groups[i]] = !all;
        b.setAttribute('aria-pressed', String(!all));
      });
      updateEstimate();
    };
    Array.prototype.forEach.call(document.querySelectorAll('input[type=checkbox]'), function (i) {
      i.addEventListener('change', updateEstimate);
    });
    $('start').disabled = false;
    updateEstimate();
  }

  function options() {
    var dirs = Array.prototype.filter
      .call(document.querySelectorAll('input[data-dir]'), function (i) {
        return i.checked;
      })
      .map(function (i) {
        return i.getAttribute('data-dir');
      });
    return {
      directions: dirs,
      parts: { foundations: $('p-foundations').checked, components: $('p-components').checked, screens: $('p-screens').checked },
      states: $('o-states').checked,
      prototype: $('o-prototype').checked,
      cover: $('o-cover').checked,
      replace: $('o-replace').checked,
      groups: Object.keys(selectedGroups).filter(function (g) {
        return selectedGroups[g];
      }),
    };
  }

  function updateEstimate() {
    if (!pack) return;
    var o = options();
    var n = pack.manifest.screens.filter(function (s) {
      return o.directions.indexOf(s.dir) >= 0 && o.groups.indexOf(s.group) >= 0 && (o.states || s.state === 'Default');
    }).length;
    var mins = Math.max(1, Math.round(n / 25));
    $('estimate').textContent = o.parts.screens ? n + ' frames will be built (about ' + mins + ' min; large files take longer).' : 'No screens selected.';
    $('start').disabled = !o.directions.length || (!o.parts.foundations && !o.parts.components && !o.parts.screens);
  }

  /* ---------- Requests from the main thread ---------- */

  function answer(msg) {
    var data = null;
    var error = null;
    try {
      var p = msg.payload;
      switch (msg.what) {
        case 'manifest':
          data = pack.manifest;
          break;
        case 'foundation':
          data = pack.foundations[p] || { tokens: [], textStyles: [], effects: [] };
          break;
        case 'components':
          data = pack.components[p] || [];
          break;
        case 'screen':
          data = pack.screens[p];
          if (!data) error = 'Screen ' + p + ' is missing from the data pack';
          break;
        case 'svg':
          data = pack.svgs[p] || null;
          break;
        case 'image':
          data = images[p] || null;
          break;
        default:
          error = 'Unknown request ' + msg.what;
      }
    } catch (e) {
      error = e.message;
    }
    post({ type: 'response', id: msg.id, data: data, error: error });
  }

  window.onmessage = function (event) {
    var msg = event.data && event.data.pluginMessage;
    if (!msg) return;
    if (msg.type === 'request') return answer(msg);
    if (msg.type === 'progress') {
      $('run-text').textContent = msg.text;
      var pct = msg.total ? Math.round((msg.done / msg.total) * 100) : 0;
      $('bar-fill').style.width = pct + '%';
      $('bar').setAttribute('aria-valuenow', String(pct));
    }
    if (msg.type === 'log') addLog(msg.level, msg.text);
    if (msg.type === 'done') {
      var s = msg.summary;
      $('run-title').textContent = 'Done';
      $('bar-fill').style.width = '100%';
      $('run-text').textContent = 'Import finished.';
      var r = $('result');
      r.hidden = false;
      r.className = 'card result';
      r.innerHTML = '<h2>Created</h2><ul>' + '<li>' + s.screens + ' screen and state frames</li>' + '<li>' + s.components + ' component variants</li>' + '<li>' + s.variables + ' variables, ' + s.textStyles + ' text styles</li>' + '<li>' + s.links + ' prototype links</li>' + '<li>' + (s.nodes || 0) + ' layers</li>' + '</ul><p class="muted small">Pages: ' + s.pages.join(', ') + '</p>';
      addLog('ok', 'Finished without errors.');
      $('cancel').hidden = true;
      $('close').hidden = false;
    }
    if (msg.type === 'failed') {
      $('run-title').textContent = 'Stopped';
      $('run-text').textContent = msg.error;
      $('cancel').hidden = true;
      $('close').hidden = false;
    }
  };

  $('start').onclick = function () {
    $('setup').hidden = true;
    $('running').hidden = false;
    $('start').hidden = true;
    $('cancel').hidden = false;
    $('close').hidden = true;
    addLog('', 'Import started.');
    post({ type: 'start', options: options() });
  };
  $('cancel').onclick = function () {
    post({ type: 'cancel' });
    addLog('warn', 'Stopping after the current frame…');
  };
  $('close').onclick = function () {
    post({ type: 'close' });
  };

  load();
})();
