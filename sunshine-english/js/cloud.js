/* =========================================================
   Sunshine English: online progress save (Supabase RPC, no account, no SDK)
   Progress lives in the browser (localStorage + IndexedDB) as always. It is ALSO
   saved online under a simple key: her first name + birthday (month + day),
   e.g. "morgane-0412". The key is remembered in this browser (localStorage + a
   cookie). If the browser data is cleared, the site asks again ("What's your
   first name and birthday?") and her progress comes back.
   Settings: js/cloud-config.js (window.SE_CLOUD = { url, anonKey }).
   Setup steps for Sam: SETUP_ONLINE_SAVE.md
   ========================================================= */
(function () {
'use strict';
var SE = window.SE;
if (!SE) return;
var CFG = window.SE_CLOUD || {};
var URL0 = String(CFG.url || '').trim().replace(/\/+$/, ''), KEY = String(CFG.anonKey || '').trim();
var CONFIGURED = !!(URL0 && KEY);
var WKEY = 'se-who-v1', MKEY = 'se-cloud-v2', CNAME = 'se_who';
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
var WHO = readWho();                       /* { key, name, m, d } */
var M = readMeta();                        /* { key, verified, lastRemoteAt, lastSyncedLocal, lastPushAt, lastPullAt } */
if (WHO && M.key !== WHO.key) M = { key: WHO.key };
var ST = { state: CONFIGURED ? (WHO ? 'idle' : 'no-key') : 'off', msg: '', busy: false };
var pushT = null, retryT = null, booted = false, dismissed = false;
function now() { return Date.now(); }
function pad(n) { return (n < 10 ? '0' : '') + n; }

/* ---------------------------------------------------------------- identity (who is saving) */
function slug(name) { return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24); }
function makeKey(name, m, d) { return slug(name) + '-' + pad(+m) + pad(+d); }
function readCookie() { var m = document.cookie.match(new RegExp('(?:^|; )' + CNAME + '=([^;]*)')); if (!m) return null; try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; } }
function validWho(w) { return !!(w && w.key && w.name && w.m >= 1 && w.m <= 12 && w.d >= 1 && w.d <= 31 && w.key === makeKey(w.name, w.m, w.d)); }
function readWho() {
  var w = null; try { w = JSON.parse(localStorage.getItem(WKEY)); } catch (e) {}
  if (!validWho(w)) { w = readCookie(); if (validWho(w)) { try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) {} } }
  return validWho(w) ? w : null;
}
function writeWho(w) {
  WHO = w;
  try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) {}
  try { document.cookie = CNAME + '=' + encodeURIComponent(JSON.stringify(w)) + '; max-age=' + (10 * 365 * 86400) + '; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
}
function clearWho() {
  WHO = null;
  try { localStorage.removeItem(WKEY); } catch (e) {}
  try { document.cookie = CNAME + '=; max-age=0; path=/; SameSite=Lax'; } catch (e) {}
}
function readMeta() { try { return JSON.parse(localStorage.getItem(MKEY)) || {}; } catch (e) { return {}; } }
function writeMeta() { try { localStorage.setItem(MKEY, JSON.stringify(M)); } catch (e) {} }
function setState(s, msg) { ST.state = s; ST.msg = msg || ''; SE.emit('cloud', ST); }
function birthday(w) { return w ? MONTHS[w.m - 1] + ' ' + w.d : ''; }
/* M.lastSyncedLocal = the local savedAt that matches what is online (after a push or a restore).
   M.lastRemoteAt = the online saved_at we last saw. Comparing with these tells who changed. */
function dirty() { var s = SE.state(); return !!s && (s.savedAt || 0) !== (M.lastSyncedLocal || 0); }

/* ---------------------------------------------------------------- HTTP (PostgREST RPC) */
function rpc(fn, body, o) {
  o = o || {};
  var h = { apikey: KEY, 'Content-Type': 'application/json' };
  if (/^eyJ/.test(KEY)) h.Authorization = 'Bearer ' + KEY;   /* legacy anon key; the new publishable key only needs apikey */
  var txt = JSON.stringify(body);
  return fetch(URL0 + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: txt, keepalive: !!o.keepalive && txt.length < 60000, cache: 'no-store' })
    .then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && (j.message || j.hint)) || ('Error ' + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
}
function isNet(e) { return !e || !e.status; }   /* fetch rejected: offline / DNS */
function getRemote(key) {
  return rpc('get_progress', { p_key: key }).then(function (rows) {
    var row = Array.isArray(rows) ? rows[0] : rows;
    return row && row.data ? { data: row.data, at: +row.saved_at || +row.data.savedAt || 0 } : null;
  });
}

/* ---------------------------------------------------------------- sync */
function isEmpty(s) { return !s || (!s.xp && !Object.keys(s.prog || {}).length && !Object.keys(s.lessons || {}).length); }
function restore(data, savedAt, msg) {
  try {
    data.savedAt = savedAt || data.savedAt || now();
    SE.importState(JSON.stringify(data));
    M.lastRemoteAt = data.savedAt; M.lastPullAt = now(); M.lastSyncedLocal = (SE.state() || {}).savedAt || 0; M.verified = true; writeMeta();
    SE.emit('change');
    setTimeout(function () { SE.toast(msg || 'Progress restored'); }, 300);
    return true;
  } catch (e) { console.warn('cloud restore failed', e); return false; }
}
/* download what's saved online for this key and decide which copy wins */
function pull() {
  if (!CONFIGURED || !WHO) return Promise.resolve();
  var key = WHO.key;
  ST.busy = true; setState('syncing');
  return getRemote(key)
    .then(function (row) {
      if (!WHO || WHO.key !== key) return;
      var local = SE.state(); M.lastPullAt = now();
      if (!row) { M.verified = true; writeMeta(); return push({ force: true }); }
      var localAt = (local && local.savedAt) || 0;
      if (!M.verified) {
        /* first contact for this key in this browser (after clearing, or a new device): an empty browser always takes the online copy */
        M.verified = true; writeMeta();
        if (isEmpty(local) || row.at >= localAt) { restore(row.data, row.at, 'Welcome back, ' + WHO.name + ': progress restored'); setState('ok'); return; }
        return push({ force: true });
      }
      var remoteChanged = Math.abs(row.at - (M.lastRemoteAt || 0)) > 1, localChanged = dirty();
      if (remoteChanged && (!localChanged || row.at > localAt)) { restore(row.data, row.at, 'Progress updated from your other device'); setState('ok'); return; }
      if (localChanged) return push({ force: true });
      setState('ok');
    })
    .catch(fail)
    .then(function () { ST.busy = false; SE.emit('cloud', ST); });
}
/* upload this browser's progress (the newer save wins, on the server too) */
function push(o) {
  o = o || {};
  var s = SE.state(); if (!CONFIGURED || !WHO || !s) return Promise.resolve();
  if (!M.verified && !o.force) return pull();          /* never upload before checking what's online for this key */
  var key = WHO.key, savedAt = s.savedAt || now();
  var send = function () {
    return rpc('save_progress', { p_key: key, p_data: s, p_saved_at: savedAt }, { keepalive: o.keepalive })
      .then(function (stored) {
        stored = +(Array.isArray(stored) ? stored[0] : stored) || savedAt;
        if (stored > savedAt + 1) { M.lastRemoteAt = 0; writeMeta(); return pull(); }   /* another device saved something newer */
        M.lastRemoteAt = savedAt; M.lastPushAt = now(); M.lastSyncedLocal = savedAt; writeMeta(); setState('ok');
      });
  };
  if (o.keepalive) return send().catch(function () {});
  setState('syncing');
  return send().catch(fail);
}
var OFFMSG = 'You’re offline. Your progress is safe in this browser and will be saved online when you’re back.';
function fail(e) {
  if (isNet(e)) { setState('offline', OFFMSG); clearTimeout(retryT); retryT = setTimeout(function () { schedule(0); }, 30000); }
  else { setState('error', (e && e.message) || 'Couldn’t save online.'); clearTimeout(retryT); retryT = setTimeout(function () { schedule(0); }, 60000); }
}
function schedule(ms) {
  if (!CONFIGURED || !WHO) return;
  clearTimeout(pushT);
  pushT = setTimeout(function () {
    if (!M.verified) { pull(); return; }
    if (dirty() || ST.state === 'offline' || ST.state === 'error') push();
  }, ms == null ? 4000 : ms);
}
function saveNow() { if (!WHO) return Promise.resolve(); clearTimeout(pushT); return M.verified ? push() : pull(); }

/* ---------------------------------------------------------------- claim a name + birthday */
function claim(name, m, d) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!slug(name)) return Promise.reject(new Error('Type your first name.'));
  var key = makeKey(name, m, d), prev = WHO;
  return getRemote(key).then(function (row) {
    var w = { key: key, name: name.charAt(0).toUpperCase() + name.slice(1), m: +m, d: +d };
    var switching = !!(prev && prev.key !== key) || !!PROMPT_SWITCH;
    writeWho(w); M = { key: key, verified: true }; writeMeta();
    var local = SE.state();
    if (row && !switching && !isEmpty(local) && ((local.savedAt || 0) > row.at)) { if (local.settings) local.settings.name = w.name; return push({ force: true }).then(function () { SE.toast('Saving as ' + w.name); return { kept: true }; }); }
    if (row) { restore(row.data, row.at, 'Welcome back, ' + w.name + ': progress restored'); setState('ok'); return { restored: true }; }
    /* nothing online yet for this person */
    if (switching) SE.resetState();
    var s = SE.state(); if (s && s.settings) s.settings.name = w.name;
    SE.save(); SE.emit('change');
    setTimeout(function () { SE.toast('Hi ' + w.name + '! Your progress now saves online too.'); }, 200);
    return push({ force: true }).then(function () { return { created: true }; });
  });
}
var PROMPT_SWITCH = false;
function switchPerson() { clearWho(); M = {}; writeMeta(); setState('no-key'); dismissed = false; showPrompt({ switching: true }); }

/* ---------------------------------------------------------------- the prompt ("What's your first name and birthday?") */
function esc(t) { return SE.esc ? SE.esc(t) : String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fr(t) { return '<div class="fr-line nogloss">' + esc(t) + '</div>'; }
function showPrompt(o) {
  o = o || {};
  if (!CONFIGURED || document.querySelector('.who-modal')) return;
  var local = SE.state(), fresh = isEmpty(local);
  var mode = o.switching ? 'switch' : fresh ? 'back' : 'setup';
  PROMPT_SWITCH = !!o.switching;
  var wrap = document.createElement('div');
  wrap.className = 'who-modal';
  function heading() {
    if (mode === 'new') return ['Welcome! Let’s keep your progress safe.', 'Tell us your first name and birthday. Your progress saves under them, so you can always get it back.', 'Bienvenue ! Donne ton prénom et ton anniversaire : ta progression est sauvegardée avec.'];
    if (mode === 'switch') return ['Who’s learning?', 'Type the first name and birthday. Each person has their own progress.', 'Qui apprend ? Chaque personne a sa propre progression.'];
    if (mode === 'setup') return ['Save your progress online', 'Tell us your first name and birthday. Then, if the browser is ever cleared, you get everything back just by typing them again.', 'Donne ton prénom et ton anniversaire : si le navigateur est vidé, tu retrouves tout en les retapant.'];
    return ['Welcome back! What’s your first name and birthday?', 'Your progress is saved under them, and it comes right back.', 'Re-bonjour ! Quel est ton prénom et ta date d’anniversaire ? Ta progression revient tout de suite.'];
  }
  function render() {
    var hd = heading(), defName = (mode === 'setup' && local && local.settings && local.settings.name) || '';
    wrap.innerHTML = '<div class="who-card card lg" role="dialog" aria-modal="true" aria-labelledby="who-h">' +
      '<div class="who-sun" aria-hidden="true"></div><h2 class="h2 who-h" id="who-h">' + esc(hd[0]) + '</h2><p class="lead who-sub">' + esc(hd[1]) + '</p>' + fr(hd[2]) +
      '<form class="who-form" novalidate><label><span>First name</span><input class="field" id="who-name" autocomplete="given-name" autocapitalize="words" spellcheck="false" maxlength="30" value="' + esc(defName) + '" placeholder="Morgane"></label>' +
      '<div class="who-bday"><label><span>Birthday: month</span><select class="field" id="who-m"><option value="">Month</option>' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + ' · ' + MONTHS_FR[i] + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Day</span><select class="field" id="who-d"><option value="">Day</option>' + Array.apply(null, Array(31)).map(function (x, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="acct-msg" id="who-msg"></div>' +
      '<button class="btn primary lg" type="submit" id="who-go">' + (mode === 'new' ? 'Start' : mode === 'back' ? 'Bring back my progress' : 'Continue') + '</button></form>' +
      '<div class="who-links">' + (mode === 'back' ? '<button type="button" class="link" data-who="new">New here? Start fresh</button>' : mode === 'new' ? '<button type="button" class="link" data-who="back">I’ve used it before</button>' : '') + '<button type="button" class="link-muted" data-who="later">Not now</button></div>' +
      '<p class="muted small who-note">Only your first name and birthday are used: no email, no password. Use the same spelling every time.</p></div>';
    var form = wrap.querySelector('.who-form');
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var name = wrap.querySelector('#who-name').value, m = wrap.querySelector('#who-m').value, d = wrap.querySelector('#who-d').value, msg = wrap.querySelector('#who-msg'), go = wrap.querySelector('#who-go');
      function say(t, cls) { msg.className = 'acct-msg ' + (cls || ''); msg.innerHTML = t; }
      if (!slug(name)) return say('Type your first name.', 'bad');
      if (!m || !d) return say('Choose the month and day of your birthday.', 'bad');
      var dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][+m - 1]; if (+d > dim) return say(MONTHS[+m - 1] + ' only has ' + dim + ' days.', 'bad');
      go.disabled = true; go.textContent = 'One moment…'; say('');
      claim(name, m, d).then(function () { close(); }).catch(function (e) {
        go.disabled = false; go.textContent = 'Try again';
        say(isNet(e) ? 'Couldn’t reach the internet. Check your connection and try again.' : esc((e && e.message) || 'Something went wrong. Try again.'), 'bad');
      });
    };
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-who]'), function (b) {
      b.onclick = function () { var k = b.getAttribute('data-who'); if (k === 'later') { dismissed = true; close(); SE.emit('cloud', ST); } else { mode = k; render(); } };
    });
    setTimeout(function () { var n = wrap.querySelector('#who-name'); if (n && window.innerWidth > 820) try { n.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  function close() { wrap.remove(); PROMPT_SWITCH = false; document.documentElement.classList.remove('who-open'); }
  render();
  document.body.appendChild(wrap);
  document.documentElement.classList.add('who-open');
}

/* ---------------------------------------------------------------- wiring */
function flush() { if (booted && WHO && M.verified && dirty()) { clearTimeout(pushT); push({ keepalive: true }); } }
if (CONFIGURED) {
  SE.on('change', function () { if (booted) schedule(); });
  SE.on('boot', function () {
    /* wait for core's IndexedDB restore (it runs up to 1.5 s when localStorage was empty) */
    setTimeout(function () {
      booted = true;
      if (WHO) pull(); else if (!dismissed) showPrompt();
      SE.emit('cloud', ST);
    }, 1700);
  });
  setInterval(function () { if (booted && WHO && dirty() && ST.state !== 'syncing') schedule(); }, 10000);
  window.addEventListener('online', function () { if (WHO) schedule(500); });
  window.addEventListener('offline', function () { if (WHO) setState('offline', OFFMSG); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}

window.SECloud = {
  configured: function () { return CONFIGURED; },
  who: function () { return WHO; },
  label: function () { return WHO ? WHO.name + ' · ' + birthday(WHO) : ''; },
  status: function () { return { state: ST.state, msg: ST.msg, busy: ST.busy, lastPush: M.lastPushAt || 0, lastPull: M.lastPullAt || 0, lastRemote: M.lastRemoteAt || 0 }; },
  saveNow: saveNow, pull: pull, prompt: function () { dismissed = false; showPrompt(); }, switchPerson: switchPerson
};
})();
