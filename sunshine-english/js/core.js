/* =========================================================
   Sunshine English — core services (v4)
   Everything the screens need: state & saving, the content index, speech,
   French help, glossary, writing feedback, speaking practice, diagrams,
   points/ranks/streak/calendar, spaced repetition (items + Anki-style cards),
   lesson states, test-out helpers, skills, stickers, the learning plan,
   and the shared question renderer (itemsPage / itemCard).
   Screens live in js/app.js (shell + Today/Journey/Library/Progress),
   js/player.js (lesson player) and js/practice.js (practice + words & phrases).
   Everything is exported on window.SE.
   ========================================================= */
(function () {
'use strict';
var C = window.SECHECK;

/* ---------------------------------------------------------------- utils */
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt(s, allowHtml) {
  s = String(s == null ? '' : s);
  if (!allowHtml) s = esc(s);
  return s.replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]{1,160}?)\*(?![*\w])/g, '$1<em class="fx">$2</em>')
    .replace(/\[([^\[\]\n]{1,40})\]/g, '<span class="v1">$1</span>')
    .replace(/\{([^{}\n]{1,40})\}/g, '<span class="v2">$1</span>')
    .replace(/\n/g, '<br>');
}
function plain(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/(^|[^*\w])\*(?!\s)([^*\n]{1,160}?)\*(?![*\w])/g, '$1$2').replace(/[\[\]{}]/g, '').replace(/<[^>]+>/g, ''); }
function hasChain(s) { return /\[[^\]]+\]|\{[^}]+\}/.test(s || ''); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
var arr = C.arr;
function dstr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }
function words(s) { return (String(s || '').trim().match(/[A-Za-zÀ-ÿ’']+/g) || []).length; }
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

/* ---------------------------------------------------------------- state + saving */
var KEY = 'sunshine-english-v1';
var S;
function blank() {
  return { xp: 0, day: { d: dstr(), xp: 0 }, streak: { last: '', n: 0 }, lessons: {}, pos: {}, prog: {}, items: {}, words: {}, tests: {}, hints: 0, writes: {}, spoken: {},
    speedBest: 0, cards: {}, log: {}, saved: {}, stickers: {}, started: dstr(), plan: {},
    settings: { rate: 0.95, online: true, autoplay: false, theme: 'light', adult: true, frenchHelp: true, name: 'Morgane', goal: 150 } };
}
function fill() {
  var b = blank(); for (var k in b) if (S[k] == null) S[k] = b[k];
  for (var k2 in b.settings) if (S.settings[k2] == null) S.settings[k2] = b.settings[k2];
  /* Love & Intimacy is on by default (Sam, Oct 28): switch it on once for existing progress; she can still turn it off in Settings */
  if (!S.settings.adultOnV7) { S.settings.adult = true; S.settings.adultOnV7 = true; }
}
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { S = blank(); }
  fill();
}
/* IndexedDB mirror (survives if localStorage gets cleared) */
var IDB = null;
function idb(cb) {
  if (IDB) return cb(IDB);
  if (!window.indexedDB) return cb(null);
  try {
    var rq = indexedDB.open('sunshine-english', 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
    rq.onsuccess = function () { IDB = rq.result; cb(IDB); };
    rq.onerror = function () { cb(null); };
  } catch (e) { cb(null); }
}
function idbPut(k, v) { idb(function (db) { if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {} }); }
function idbGet(k, cb) { idb(function (db) { if (!db) return cb(null); try { var r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = function () { cb(r.result); }; r.onerror = function () { cb(null); }; } catch (e) { cb(null); } }); }
var FILEH = null, fileTimer = null, saveOK = true, RESTORING = false;
var DIRH = null, dirTimer = null, DIRSTATE = 'none'; /* backup folder: none | ok | needs-permission | unsupported */
function save() {
  if (S) S.savedAt = Date.now();
  var json = JSON.stringify(S);
  saveOK = false;
  try { localStorage.setItem(KEY, json); saveOK = true; } catch (e) {}
  if (!RESTORING) idbPut('state', json); if (!saveOK && window.indexedDB) saveOK = true;
  savedFlash();
  if (FILEH) { clearTimeout(fileTimer); fileTimer = setTimeout(function () { writeFile(json); }, 1200); }
  if (DIRH) { clearTimeout(dirTimer); dirTimer = setTimeout(function () { writeBackupFolder(json); }, 2500); }
}
function savedFlash() {
  var s = $('#hsaved'); if (!s) return;
  s.textContent = saveOK ? '✓ Saved' : '⚠ Not saved'; s.classList.toggle('bad', !saveOK);
  s.classList.add('on'); clearTimeout(savedFlash._t); savedFlash._t = setTimeout(function () { s.classList.remove('on'); }, 1500);
}
function writeFile(json) {
  if (!FILEH) return;
  FILEH.createWritable().then(function (w) { return w.write(json).then(function () { return w.close(); }); }).catch(function () {});
}

/* ---------------------------------------------------------------- index */
var COURSE_ORDER = ['path', 'school', 'gym', 'tampa', 'skills', 'reading', 'career', 'citizen', 'adult'];
var LESSONS = {}, ORDER = {}, ITEMS = {}, WORDS = [], WORDMAP = {};
var GRADED = { mcq: 1, pic: 1, type: 1, fix: 1, order: 1, listen: 1 };
function courseVisible(cid) { return cid !== 'adult' || (S && S.settings.adult); }
function lidVisible(lid) { var L = LESSONS[lid]; return !!L && courseVisible(L.course.id) && !(L.level.adult && !(S && S.settings.adult)); }
function visibleCourses() { return COURSE_ORDER.filter(function (c) { return ENG.courses[c] && courseVisible(c); }); }
function autoSpeak(ls) {
  if (ls.steps.some(function (s) { return s.type === 'speak'; })) return;
  var sentences = [];
  ls.steps.forEach(function (s) { if (s.type === 'learn') (s.cards || []).forEach(function (c) { var t = plain(c.en).split(' / ')[0].trim(); if (t && sentences.length < 6 && words(t) <= 22) sentences.push(t); }); });
  var dl = ls.steps.filter(function (s) { return s.type === 'dialogue'; })[0];
  if (sentences.length < 4 && dl) dl.lines.forEach(function (l) { var t = plain(l.t); if (sentences.length < 6 && words(t) >= 3 && words(t) <= 18) sentences.push(t); });
  var para = '';
  var rd = ls.steps.filter(function (s) { return s.type === 'read'; })[0];
  var src = rd ? plain(rd.text) : (dl ? dl.lines.map(function (l) { return plain(l.t); }).join(' ') : '');
  if (src) {
    var sents = src.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+["”’)]?\s*/g) || [src];
    for (var i = 0; i < sents.length && words(para) < 100; i++) para += sents[i];
    para = para.trim();
    if (words(para) > 170) para = para.split(/\s+/).slice(0, 140).join(' ') + '…';
  }
  if (!sentences.length && !para) return;
  var st = { type: 'speak', title: 'Say it out loud', intro: 'Press the mic and say each sentence. Then read the paragraph out loud. The app listens and shows which words came through.', sentences: sentences, paragraph: para, auto: true };
  var at = -1; ls.steps.forEach(function (s, i) { if (s.type === 'write' && at < 0) at = i; });
  if (at < 0) at = Math.max(0, ls.steps.length - 1);
  ls.steps.splice(at, 0, st);
}
function buildIndex() {
  COURSE_ORDER.forEach(function (cid) {
    var c = ENG.courses[cid]; if (!c) return;
    c.levels.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    ORDER[cid] = [];
    c.levels.forEach(function (lv, li) {
      lv.lessons.forEach(function (ls, i) {
        /* speaking is optional now (Sam: fewer audio activities); see SE.autoSpeakStep */
        LESSONS[ls.id] = { lesson: ls, level: lv, course: c, li: li, i: i };
        ORDER[cid].push(ls.id);
        var gl = ls.gloss || {};
        ls.steps.forEach(function (st, si) {
          var sg = Object.assign({}, gl, st.gloss || {});
          (st.items || []).forEach(function (it, ii) { if (GRADED[it.k]) ITEMS[ls.id + '#' + si + '.' + ii] = { item: it, lid: ls.id, gloss: sg, si: si, final: si === ls.steps.length - 1 }; });
          (st.check || []).forEach(function (it, ii) { if (GRADED[it.k]) ITEMS[ls.id + '#' + si + '.c' + ii] = { item: it, lid: ls.id, gloss: sg, si: si }; });
          if (st.type === 'words') {
            (st.words || []).forEach(function (w, wi) { var o = { id: ls.id + ':' + wi, w: w, lid: ls.id }; WORDS.push(o); WORDMAP[o.id] = o; });
            (st.everyday || []).forEach(function (w, wi) { if (w.pic && !w.img) w.img = w.pic; var o = { id: ls.id + ':e' + wi, w: w, lid: ls.id, everyday: true }; WORDS.push(o); WORDMAP[o.id] = o; });
          }
        });
      });
    });
  });
}

/* ---------------------------------------------------------------- images (local files: images/<key>.jpg) */
var FE = {};
function imgRec(key) {
  if (!key) return null;
  if (typeof key === 'string' && key.indexOf('fe:') === 0) { var n = key.slice(3); return FE[n] || (FE[n] = { u: 'images/fe/' + n + '.png', by: 'Microsoft Fluent Emoji', lic: 'MIT', illus: true }); }
  return ENG.images[key] && ENG.images[key].u ? ENG.images[key] : null;
}
function illusCls(im) { return im && im.illus ? ' illus' : ''; }
function imgHTML(key, cls, opt) {
  opt = opt || {};
  var im = imgRec(key);
  var label = esc(ENG.imgq[key] || String(key || '').replace(/_/g, ' '));
  if (!im) return opt.optional ? '' : '<div class="ph ' + (cls || '') + '"><div class="ph-fb"><div><b>🖼️</b>' + label + '</div></div></div>';
  return '<div class="ph ' + (cls || '') + illusCls(im) + '"><div class="ph-fb"><div><b>🖼️</b>' + label + '</div></div><img loading="lazy" alt="' + label + '" src="' + esc(im.u) + '" onerror="this.remove()"></div>';
}

/* ---------------------------------------------------------------- speech out (text to speech) */
var VOICES = [];
function loadVoices() {
  if (!window.speechSynthesis) return;
  var all = speechSynthesis.getVoices();
  var us = all.filter(function (v) { return /en[-_]US/i.test(v.lang); });
  var rank = function (v) { return /Samantha|Aria|Jenny|Google US English|Natural|Neural|Ava|Allison|Joelle|Zoe|Evan|Nathan|Alex|Tom/i.test(v.name) ? 0 : 1; };
  us.sort(function (a, b) { return rank(a) - rank(b); });
  VOICES = us.length ? us : all.filter(function (v) { return /^en/i.test(v.lang); });
}
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function stopSpeech() { if (window.speechSynthesis) speechSynthesis.cancel(); }
function speak(text, opt) {
  opt = opt || {};
  if (!window.speechSynthesis) { if (!speak._warned) { speak._warned = 1; toast('Audio isn’t available in this browser'); } if (opt.onend) setTimeout(opt.onend, 50); return; }
  if (!opt.queue) speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(plain(text));
  u.lang = 'en-US';
  u.rate = opt.slow ? 0.7 : (S.settings.rate || 0.95);
  var v = VOICES[(opt.voice || 0) % Math.max(1, VOICES.length)];
  if (v) u.voice = v;
  if (opt.onstart) u.onstart = opt.onstart;
  if (opt.onend) { u.onend = opt.onend; u.onerror = opt.onend; }
  speechSynthesis.speak(u);
}
function sayBtn(text, slow) { return '<button class="say' + (slow ? ' slow' : '') + '" data-say="' + esc(plain(text)) + '"' + (slow ? ' data-slow="1"' : '') + ' title="Listen" aria-label="Listen">' + (slow ? 'Slower' : '▶') + '</button>'; }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-say]'); if (!b) return;
  e.preventDefault(); e.stopPropagation(); speak(b.getAttribute('data-say'), { slow: !!b.getAttribute('data-slow'), voice: +(b.getAttribute('data-voice') || 0) });
});

/* ---------------------------------------------------------------- french: hint buttons + tap-to-translate */
function frBtn(fr, label) { return fr ? '<button class="frbtn" data-fr="' + esc(fr) + '">' + (label || 'FR') + '</button>' : ''; }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-fr]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  var host = b.parentNode, box = host.nextElementSibling;
  if (box && box.classList.contains('frtxt')) { box.remove(); b.textContent = b.getAttribute('data-label'); return; }
  var d = document.createElement('div'); d.className = 'frtxt'; d.textContent = b.getAttribute('data-fr');
  host.insertAdjacentElement('afterend', d);
  b.setAttribute('data-label', b.textContent); b.textContent = 'Hide';
  if (b.hasAttribute('data-hint')) { S.hints++; save(); var card = b.closest('.icard'); if (card) card.setAttribute('data-hinted', '1'); }
});
/* English text you can tap to see the French */
function trSpan(en, fr, isHtml) {
  var inner = isHtml ? en : esc(en);
  return fr ? '<span class="tr" data-tr="' + esc(fr) + '" title="Tap for French" tabindex="0">' + inner + '</span>' : '<span>' + inner + '</span>';
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('.tr'); if (!t || e.target.closest('.gl')) return;
  e.preventDefault(); e.stopPropagation();
  var host = t.closest('.w, .en') || t.parentNode, box = host.nextElementSibling;
  if (box && box.classList.contains('trfr')) { box.remove(); t.classList.remove('open'); return; }
  var d = document.createElement('div'); d.className = 'frtxt trfr'; d.textContent = t.getAttribute('data-tr');
  host.insertAdjacentElement('afterend', d); t.classList.add('open');
});
document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tr')) { e.preventDefault(); e.target.click(); } });

/* ---------------------------------------------------------------- glossary (underlined words + hover box) */
function normKey(s) { return String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
function applyGloss(root, map) {
  if (!root || !map) return;
  var keys = Object.keys(map).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
  if (!keys.length) return;
  var lookup = {}; keys.forEach(function (k) { lookup[normKey(k)] = map[k]; });
  var pat = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]").replace(/\s+/g, '\\s+'); }).join('|');
  var re = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + pat + ')(?![A-Za-zÀ-ÿ])', 'i');
  var used = {};
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
    var p = n.parentNode;
    while (p && p !== root) { if (p.nodeType === 1 && (/^(BUTTON|TEXTAREA|INPUT|SCRIPT|A|LABEL)$/.test(p.tagName) || p.namespaceURI === 'http://www.w3.org/2000/svg' || p.classList.contains('gl') || p.classList.contains('frtxt') || p.classList.contains('nogloss') || p.classList.contains('tr') || p.classList.contains('spw'))) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
    return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  } });
  var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    var text = node.nodeValue, frag = null, last = 0, m, offset = 0, rest = text;
    while ((m = re.exec(rest))) {
      var term = m[2], k = normKey(term), start = offset + m.index + m[1].length;
      offset = start + term.length; rest = text.slice(offset);
      if (used[k] || !lookup[k]) continue;
      used[k] = 1;
      var def = lookup[k];
      frag = frag || document.createDocumentFragment();
      frag.appendChild(document.createTextNode(text.slice(last, start)));
      var sp = document.createElement('span'); sp.className = 'gl'; sp.tabIndex = 0; sp.textContent = term;
      sp.setAttribute('data-term', term); sp.setAttribute('data-def', typeof def === 'string' ? def : (def.def || ''));
      if (def.fr) sp.setAttribute('data-gfr', def.fr);
      frag.appendChild(sp); last = start + term.length;
    }
    if (frag) { frag.appendChild(document.createTextNode(text.slice(last))); node.parentNode.replaceChild(frag, node); }
  });
}
function showTip(g) {
  var tip = $('#tip');
  tip.innerHTML = '<b>' + esc(g.getAttribute('data-term')) + '</b>' + esc(g.getAttribute('data-def')) + (g.getAttribute('data-gfr') ? '<div class="fr">🇫🇷 ' + esc(g.getAttribute('data-gfr')) + '</div>' : '');
  tip.classList.remove('hide');
  var r = g.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8) + 'px';
  var y = r.top - th - 8; tip.style.top = (y < 60 ? r.bottom + 8 : y) + 'px';
}
function hideTip() { $('#tip').classList.add('hide'); }
document.addEventListener('mouseover', function (e) { var g = e.target.closest && e.target.closest('.gl'); if (g) showTip(g); });
document.addEventListener('mouseout', function (e) { var g = e.target.closest && e.target.closest('.gl'); if (g) hideTip(); });
document.addEventListener('click', function (e) { var g = e.target.closest('.gl'); if (g) showTip(g); else if (!e.target.closest('#tip')) hideTip(); }, true);
window.addEventListener('scroll', hideTip, { passive: true });

/* ---------------------------------------------------------------- writing feedback (never "wrong") */
var NUMW = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|several|many';
var SUBJ_BE = { i: 'am', you: 'are', we: 'are', they: 'are', he: 'is', she: 'is' };
function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
var TRAPS = [
  { re: /\b(i|you|we|they|he|she)\s+(have|has)\s+(\d+)\s+(years?|ans)(\s+old)?\b/gi, fix: function (m, p) { return p[1] + ' ' + SUBJ_BE[p[1].toLowerCase()] + ' ' + p[3]; }, msg: 'For age, English uses “be”: I’m 30 (not “I have 30 years”).' },
  { re: /\b(i|you|we|they|he|she)\s+(have|has)\s+(hunger|hungry|thirst|thirsty|cold|hot|right|wrong|fear|sleepy)\b/gi, fix: function (m, p) { var w = p[3].toLowerCase(); return p[1] + ' ' + SUBJ_BE[p[1].toLowerCase()] + ' ' + ({ hunger: 'hungry', thirst: 'thirsty', fear: 'scared' }[w] || w); }, msg: 'Feelings use “I’m”: I’m hungry, I’m cold, you’re right.' },
  { re: /\b(am|is|are|['’]m|['’]re|['’]s)\s+agree\b/gi, fix: function () { return 'agree'; }, msg: 'Just say “I agree” (not “I am agree”).' },
  { re: new RegExp('\\bsince\\s+(' + NUMW + ')\\s+(years?|months?|weeks?|days?|hours?|minutes?)\\b', 'gi'), fix: function (m, p) { return 'for ' + p[1] + ' ' + p[2]; }, msg: 'Use “for” + an amount of time (for two years), and “since” + a starting point (since 2024).' },
  { re: /\b(informations|advices|furnitures|equipments|homeworks|researches|knowledges|luggages|baggages|softwares|feedbacks|evidences)\b/gi, fix: function (m) { return m.replace(/s$/i, ''); }, msg: 'No -s on this word in English (information, advice, equipment…).' },
  { re: /\b(speak|speaks|spoke|talk|talks)\s+(very\s+)?(well|good|badly|fluently)\s+(english|french|spanish)\b/gi, fix: function (m, p) { return p[1] + ' ' + cap(p[4]) + ' ' + (p[2] || '') + p[3]; }, msg: 'Word order: I speak English very well.' },
  { re: /\bexplain\s+(me|him|her|us|them)\b/gi, fix: function (m, p) { return 'explain (it) to ' + p[1]; }, msg: 'Say “explain it to me”, not “explain me”.' },
  { re: /\bdepend(s|ed|ing)?\s+of\b/gi, fix: function (m, p) { return 'depend' + (p[1] || '') + ' on'; }, msg: '“Depend on” (not “depend of”).' },
  { re: /\binterested\s+by\b/gi, fix: function () { return 'interested in'; }, msg: '“Interested in” (not “by”).' },
  { re: /\barriv(e|es|ed|ing)\s+to\b/gi, fix: function (m, p) { return 'arriv' + p[1] + ' in/at'; }, msg: '“Arrive in” a city, “arrive at” a place (not “arrive to”).' },
  { re: /\bmarried\s+with\b/gi, fix: function () { return 'married to'; }, msg: '“Married to” (not “with”).' },
  { re: /\bdiscuss(es|ed)?\s+about\b/gi, fix: function (m, p) { return 'discuss' + (p[1] || ''); }, msg: '“Discuss” needs no “about”: discuss the plan / talk about the plan.' },
  { re: /\bthe\s+(life|people|nature|money|love|society)\s+(is|are)\b/gi, fix: function (m, p) { return p[1] + ' ' + p[2]; }, msg: 'For general ideas, no “the”: Life is good. People are friendly.' },
  { re: /\bpeople\s+is\b/gi, fix: function () { return 'people are'; }, msg: '“People” is plural: people are.' },
  { re: /\bif\s+(i|you|he|she|we|they|it)\s+would\b/gi, fix: function (m, p) { return 'if ' + p[1] + ' + had / were / went…'; }, msg: 'After “if”, don’t use “would”: If I had time, I would go.' },
  { re: /\b(make|made|making|makes)\s+(a\s+)?(photo|picture|party|sport|sports)\b/gi, fix: function (m, p) { var n = p[3].toLowerCase(); return (n === 'photo' || n === 'picture') ? 'take a ' + n : (n === 'party' ? 'have a party' : 'play sports / work out'); }, msg: 'English uses a different verb: take a photo, have a party, play sports.' },
  { re: /\b(do|did|does|doing)\s+(a\s+)?(mistake|mistakes)\b/gi, fix: function (m, p) { return 'make ' + (p[2] || '') + p[3]; }, msg: 'We “make” mistakes (not do).' },
  { re: /\bhow\s+do\s+you\s+call\b/gi, fix: function () { return 'what do you call'; }, msg: '“What do you call…?” (not “How do you call…?”).' },
  { re: /\bassist(ed)?\s+(to|at)\s+(a|the)\s+(meeting|class|conference|appointment)/gi, fix: function (m, p) { return 'attend' + (p[1] ? 'ed' : '') + ' ' + p[3] + ' ' + p[4]; }, msg: '“Assist” means help. To go to a meeting = attend.' },
  { re: /\bit\s+makes\s+(hot|cold|warm|nice|beautiful|sunny)\b/gi, fix: function (m, p) { return 'it’s ' + p[1]; }, msg: 'Weather: It’s hot / It’s nice (not “it makes”).' },
  { re: /\b(tomorrow|tonight|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:weekend|evening|afternoon))\b[^.?!]{0,25}?\bI\s+(go|eat|call|work|see|visit|cook|buy|come|leave|meet)\b|\bI\s+(go|eat|call|work|see|visit|cook|buy|come|leave|meet)\b[^.?!]{0,30}?\b(tomorrow|tonight|next\s+(?:week|month|year)|this\s+(?:weekend|evening|afternoon))\b/gi, fix: function (m) { return m.replace(/\bI\s+(go|eat|call|work|see|visit|cook|buy|come|leave|meet)\b/i, function (x, v) { return 'I’m going to ' + v; }); }, msg: 'For a plan in the future, say “I’m going to…” (or “I’m …ing”): Tomorrow I’m going to call her.' }
];
var AUXRE = /\b(do|does|did|don['’]t|doesn['’]t|didn['’]t|can|can['’]t|could|couldn['’]t|will|won['’]t|would|wouldn['’]t|should|shouldn['’]t|must|might)\s+(?:(i|you|he|she|it|we|they|not)\s+)?([a-z]+)\b/gi;
var CAPWORDS = 'monday tuesday wednesday thursday friday saturday sunday january february april june july august september october november december english french american spanish italian german'.split(' ');
function trapCheck(text) {
  var out = [];
  TRAPS.forEach(function (t) { t.re.lastIndex = 0; var m; while ((m = t.re.exec(text))) out.push({ i: m.index, len: m[0].length, from: m[0], to: t.fix(m[0], m), msg: t.msg, src: 'fr' }); });
  var m2; AUXRE.lastIndex = 0;
  while ((m2 = AUXRE.exec(text))) {
    var v = m2[3].toLowerCase(); if (v === 'is' || v === 'was' || v === 'need') continue;
    var b = C.IRR[v] || C.thirdToBase(v) || (/ed$/.test(v) && C.BASESET[v.slice(0, -2)] ? v.slice(0, -2) : (/ed$/.test(v) && C.BASESET[v.slice(0, -1)] ? v.slice(0, -1) : null));
    if (b && b !== v && b !== 'be') out.push({ i: m2.index + m2[0].length - m2[3].length, len: v.length, from: m2[3], to: b, msg: 'After “' + m2[1] + '”, use the simple verb: ' + b + '.', src: 'fr' });
  }
  var re3 = /(\b\w+['’]?\w*\s+)?\b(he|she|it)\s+([a-z]+)\b/gi, m3;
  while ((m3 = re3.exec(text))) {
    var prev = (m3[1] || '').trim().toLowerCase().replace(/’/g, "'"), w3 = m3[3].toLowerCase();
    if (!C.BASESET[w3] || /^(do|does|did|don't|doesn't|didn't|can|can't|could|will|won't|would|should|must|might|may|let|make|made|help|helped|saw|see|watch|heard|hear|that|if)$/.test(prev)) continue;
    var form = w3 === 'have' ? 'has' : w3 === 'do' ? 'does' : w3 === 'go' ? 'goes' : /(s|sh|ch|x|o)$/.test(w3) ? w3 + 'es' : /[^aeiou]y$/.test(w3) ? w3.slice(0, -1) + 'ies' : w3 + 's';
    out.push({ i: m3.index + m3[0].length - m3[3].length, len: w3.length, from: m3[3], to: form, msg: 'With he / she / it, add -s: ' + m3[2] + ' ' + form + '. (If you mean the past, use the past form.)', src: 'fr' });
  }
  var reC = new RegExp('\\b(' + CAPWORDS.join('|') + ')\\b', 'g'), m4;
  while ((m4 = reC.exec(text))) out.push({ i: m4.index, len: m4[0].length, from: m4[0], to: cap(m4[0]), msg: 'Days, months, languages and nationalities start with a capital letter.', src: 'fr' });
  var reI = /(^|[\s(])i(?=[\s,.!?'’])/g, m5;
  while ((m5 = reI.exec(text))) out.push({ i: m5.index + m5[1].length, len: 1, from: 'i', to: 'I', msg: '“I” is always a capital letter.', src: 'fr' });
  var tips = { actually: '“Actually” = en fait. For “actuellement”, say currently / right now.', eventually: '“Eventually” = finalement. For “éventuellement”, say possibly / maybe.', sensible: '“Sensible” = raisonnable. For “sensible”, say sensitive.', library: '“Library” = bibliothèque. A librairie is a bookstore.', sympathetic: '“Sympathetic” = compatissant. For “sympa”, say nice / friendly.' };
  var reT = /\b(actually|eventually|sensible|library|sympathetic)\b/gi, m6;
  while ((m6 = reT.exec(text))) out.push({ i: m6.index, len: m6[0].length, from: m6[0], to: null, msg: 'Check the meaning: ' + tips[m6[1].toLowerCase()], src: 'tip' });
  return dedupe(out);
}
function dedupe(list) { list.sort(function (a, b) { return a.i - b.i; }); var res = []; list.forEach(function (x) { if (!res.some(function (y) { return x.i < y.i + y.len && y.i < x.i + x.len; })) res.push(x); }); return res; }
function onlineCheck(text) {
  if (!S.settings.online || !window.fetch) return Promise.resolve(null);
  var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
  return fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'language=en-US&motherTongue=fr&text=' + encodeURIComponent(text), signal: ctrl ? ctrl.signal : undefined })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { clearTimeout(t); if (!j) return null; return (j.matches || []).filter(function (m) { return !/PUNCT|COMMA|TYPOGRAPH|APOS|WHITESPACE/i.test((m.rule && (m.rule.id + ' ' + (m.rule.category && m.rule.category.id))) || ''); }).map(function (m) { return { i: m.offset, len: m.length, from: text.substr(m.offset, m.length), to: (m.replacements && m.replacements[0] && m.replacements[0].value) || null, msg: m.message, src: 'lt' }; }); })
    .catch(function () { clearTimeout(t); return null; });
}
function feedbackBlock(text, opts) {
  opts = opts || {};
  var local = trapCheck(text), box = document.createElement('div');
  function paint(lt, state) {
    var all = dedupe(local.concat(lt || [])), fixes = all.filter(function (x) { return x.src !== 'tip'; }), tips = all.filter(function (x) { return x.src === 'tip'; });
    var hl = '', pos = 0;
    all.forEach(function (x) { hl += esc(text.slice(pos, x.i)) + '<span class="hl" title="' + esc(x.msg) + '">' + esc(text.substr(x.i, x.len)) + '</span>'; pos = x.i + x.len; });
    hl += esc(text.slice(pos));
    var h = '<div class="fbbox"><h4>✏️ Suggestions ' + (fixes.length ? '(' + fixes.length + ')' : '') + '</h4>';
    if (!fixes.length && !tips.length) h += '<div class="it">No corrections found. Nice! Compare with the model answer for more natural ways to say it.</div>';
    fixes.forEach(function (x) { h += '<div class="it">' + (x.to ? '<span class="from">' + esc(x.from) + '</span> → <span class="to">' + esc(x.to) + '</span>' : '<b>' + esc(x.from) + '</b>') + '<small>' + esc(x.msg) + '</small></div>'; });
    tips.forEach(function (x) { h += '<div class="it">💡 <b>' + esc(x.from) + '</b><small>' + esc(x.msg) + '</small></div>'; });
    if (state === 'loading') h += '<div class="it"><small>Checking grammar…</small></div>';
    h += '</div>';
    if (all.length) h += '<div class="fbbox"><h4>Your text</h4><div class="mine">' + hl + '</div></div>';
    if (opts.checklist && opts.checklist.length) h += '<div class="fbbox checkl"><h4>Self-check</h4>' + opts.checklist.map(function (c) { return '<label><input type="checkbox"> <span>' + fmt(c) + '</span></label>'; }).join('') + '</div>';
    if (opts.model) h += '<div class="fbbox"><h4>Model answer ' + sayBtn(opts.model) + '</h4><div class="model">' + fmt(opts.model) + '</div></div>';
    box.innerHTML = h;
  }
  paint(null, S.settings.online ? 'loading' : '');
  onlineCheck(text).then(function (lt) { paint(lt, ''); });
  return box;
}

/* ---------------------------------------------------------------- speaking (speech recognition) */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
var SRFAIL = false, ACTIVE_REC = null;
var NUMS = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve', '15': 'fifteen', '20': 'twenty', '30': 'thirty' };
function tokens(s) { return C.norm(s).split(' ').filter(Boolean).map(function (t) { return NUMS[t] || t; }); }
function teq(a, b) { return a === b || (a.length >= 4 && b.length >= 4 && C.lev(a, b) <= 1) || a.replace(/s$/, '') === b.replace(/s$/, '') && a.length > 3; }
/* split display words -> each with its tokens */
function wordModel(text) {
  var ws = String(text).split(/\s+/).filter(Boolean);
  var flat = [];
  ws.forEach(function (w, i) { tokens(w).forEach(function (t) { flat.push({ t: t, w: i }); }); });
  return { ws: ws, flat: flat };
}
function lcsMatch(flat, heard) {
  var n = flat.length, m = heard.length, d = [], i, j;
  for (i = 0; i <= n; i++) { d[i] = []; for (j = 0; j <= m; j++) d[i][j] = 0; }
  for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) d[i][j] = teq(flat[i].t, heard[j]) ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  var ok = flat.map(function () { return false; }); i = 0; j = 0;
  while (i < n && j < m) { if (teq(flat[i].t, heard[j])) { ok[i] = true; i++; j++; } else if (d[i + 1][j] >= d[i][j + 1]) i++; else j++; }
  return ok;
}
function wordsOK(model, okFlat) {
  var res = model.ws.map(function () { return { n: 0, k: 0 }; });
  model.flat.forEach(function (f, i) { res[f.w].n++; if (okFlat[i]) res[f.w].k++; });
  return res.map(function (r) { return r.n === 0 ? null : r.k / r.n >= 0.5; });
}
function stopRec() { if (ACTIVE_REC) { try { ACTIVE_REC.onend = null; ACTIVE_REC.abort(); } catch (e) {} ACTIVE_REC = null; } $$('.mic.on').forEach(function (b) { b.classList.remove('on'); b.textContent = b.getAttribute('data-label') || '🎤 Say it'; }); }
function srError(err, box) {
  if (/not-allowed|service-not-allowed|network|audio-capture/.test(err)) {
    SRFAIL = true;
    var msg = err === 'network' ? 'Speech recognition needs an internet connection in this browser.' : err === 'audio-capture' ? 'No microphone was found.' : 'The microphone is blocked. Allow it in the browser’s address bar, or use Record & play back.';
    toast(msg);
    $$('.speakpanel').forEach(function (p) { p.classList.add('nosr'); });
  } else if (err === 'no-speech') toast('I didn’t hear anything. Try again a little closer to the mic.');
}
function micRecorder(onDone) {
  /* fallback: record yourself and listen back */
  var wrap = el('<span class="recwrap"><button class="btn sm rec">⏺ Record</button></span>');
  var btn = wrap.firstChild, mr = null, chunks = [];
  btn.onclick = function () {
    if (mr && mr.state === 'recording') { mr.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Recording isn’t available here. Listen, say it out loud, then tap “I said it”.'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      chunks = []; mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var a = wrap.querySelector('audio') || document.createElement('audio'); a.controls = true; a.src = URL.createObjectURL(new Blob(chunks)); wrap.appendChild(a); a.play();
        btn.textContent = '⏺ Record again'; btn.classList.remove('on'); if (onDone) onDone();
      };
      mr.start(); btn.textContent = '⏹ Stop'; btn.classList.add('on');
    }).catch(function () { toast('The microphone is blocked. Say it out loud, then tap “I said it”.'); });
  };
  return wrap;
}
function sentenceRow(text, idx, key) {
  var model = wordModel(text);
  var row = el('<div class="sprow"><div class="spnum">' + idx + '</div><div class="spbody"><div class="spline">' + model.ws.map(function (w, i) { return '<span class="spw" data-i="' + i + '">' + esc(w) + '</span>'; }).join(' ') + '</div>' +
    '<div class="sptools">' + sayBtn(text) + sayBtn(text, true) + '<button class="btn sm mic" data-label="🎤 Say it">🎤 Say it</button><span class="fbk"></span><button class="btn sm ghost selfok">I said it ✓</button></div><div class="sphear"></div></div></div>');
  var mic = $('.mic', row), hear = $('.sphear', row), fbk = $('.fbk', row), selfok = $('.selfok', row);
  var tools = $('.sptools', row); tools.insertBefore(micRecorder(), selfok);
  function award(score) {
    if (score >= 0.8 && !S.spoken[key]) { S.spoken[key] = 1; addXP(5); }
    row.classList.toggle('done', score >= 0.8);
  }
  selfok.onclick = function () { award(1); fbk.innerHTML = '<span class="tag ok">✓ nice</span>'; };
  mic.onclick = function () {
    if (mic.classList.contains('on')) { stopRec(); return; }
    if (!SR || SRFAIL) { toast('Speech recognition isn’t available here. Use ⏺ Record, then tap “I said it”.'); return; }
    stopRec(); stopSpeech();
    var rec = new SR(); ACTIVE_REC = rec;
    rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = false;
    mic.classList.add('on'); mic.textContent = '⏹ Listening…'; hear.textContent = '';
    var best = null;
    rec.onresult = function (e) {
      var r = e.results[e.results.length - 1];
      hear.textContent = '“' + r[0].transcript + '”';
      if (r.isFinal) {
        for (var a = 0; a < r.length; a++) {
          var ok = wordsOK(model, lcsMatch(model.flat, tokens(r[a].transcript)));
          var sc = ok.filter(function (x) { return x !== false; }).length / Math.max(1, ok.length);
          if (!best || sc > best.sc) best = { sc: sc, ok: ok, t: r[a].transcript };
        }
      }
    };
    rec.onerror = function (e) { srError(e.error, row); };
    rec.onend = function () {
      ACTIVE_REC = null; mic.classList.remove('on'); mic.textContent = '🎤 Try again';
      if (!best) return;
      hear.textContent = 'I heard: “' + best.t + '”';
      $$('.spw', row).forEach(function (s, i) { s.classList.remove('ok', 'miss'); s.classList.add(best.ok[i] === false ? 'miss' : 'ok'); });
      var pc = Math.round(best.sc * 100);
      fbk.innerHTML = '<span class="tag ' + (pc >= 80 ? 'ok' : 'sun') + '">' + pc + '%</span> ' + (pc >= 80 ? 'Great!' : 'Try again: say the red words clearly.');
      award(best.sc);
    };
    try { rec.start(); } catch (e) { srError('network'); mic.classList.remove('on'); }
  };
  return row;
}
/* paragraph read-aloud with live highlighting */
function readAloud(text, key) {
  var model = wordModel(text);
  var box = el('<div class="readaloud"><div class="ratext">' + model.ws.map(function (w, i) { return '<span class="spw" data-i="' + i + '">' + esc(w) + '</span>'; }).join(' ') + '</div>' +
    '<div class="sptools">' + sayBtn(text) + '<button class="btn sm pri mic" data-label="🎤 Start reading">🎤 Start reading</button><button class="btn sm ghost selfok">I read it ✓</button></div><div class="sphear"></div><div class="rasum"></div></div>');
  var mic = $('.mic', box), hear = $('.sphear', box), sum = $('.rasum', box), selfok = $('.selfok', box);
  $('.sptools', box).insertBefore(micRecorder(), selfok);
  var spans = $$('.spw', box), okFlat = model.flat.map(function () { return false; }), p = 0, active = false;
  function paint() {
    var ok = wordsOK(model, okFlat);
    var curW = p < model.flat.length ? model.flat[p].w : -1;
    spans.forEach(function (s, i) { s.classList.toggle('ok', ok[i] === true); s.classList.toggle('cur', i === curW && active); });
  }
  function feed(heard) {
    heard.forEach(function (h) {
      for (var j = p; j < Math.min(model.flat.length, p + 7); j++) if (teq(model.flat[j].t, h)) { okFlat[j] = true; p = j + 1; return; }
    });
    paint();
  }
  function finish() {
    active = false; paint();
    var ok = wordsOK(model, okFlat), n = ok.filter(function (x) { return x !== null; }).length, k = ok.filter(function (x) { return x === true; }).length;
    var missed = []; ok.forEach(function (x, i) { if (x === false) { spans[i].classList.add('miss'); var w = model.ws[i].replace(/[^A-Za-zÀ-ÿ’'-]/g, ''); if (w && missed.indexOf(w) < 0) missed.push(w); } });
    var pc = Math.round(k / Math.max(1, n) * 100);
    sum.innerHTML = '<div class="fb ' + (pc >= 80 ? 'ok' : 'info') + '"><b>' + pc + '% of the words came through.</b>' + (missed.length ? '<span class="why">Practice these words: ' + missed.slice(0, 15).map(function (w) { return '<button class="chip" data-say="' + esc(w) + '">' + esc(w) + '</button>'; }).join(' ') + '</span>' : '<span class="why">Excellent reading!</span>') + '</div>';
    if (pc >= 50 && !S.spoken[key]) { S.spoken[key] = 1; addXP(20); }
  }
  selfok.onclick = function () { if (!S.spoken[key]) { S.spoken[key] = 1; addXP(20); } sum.innerHTML = '<div class="fb ok"><b>👍 Great, reading out loud every day builds fluency.</b></div>'; };
  mic.onclick = function () {
    if (active) { active = false; stopRec(); finish(); return; }
    if (!SR || SRFAIL) { toast('Speech recognition isn’t available here. Use ⏺ Record, then tap “I read it”.'); return; }
    stopRec(); stopSpeech();
    okFlat = model.flat.map(function () { return false; }); p = 0; sum.innerHTML = ''; spans.forEach(function (s) { s.classList.remove('ok', 'miss'); });
    active = true; mic.classList.add('on'); mic.textContent = '⏹ Stop';
    function startOne() {
      var rec = new SR(); ACTIVE_REC = rec;
      rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
      var doneIdx = 0;
      rec.onresult = function (e) {
        var interim = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) { if (i >= doneIdx) { feed(tokens(e.results[i][0].transcript)); doneIdx = i + 1; } }
          else interim += e.results[i][0].transcript;
        }
        hear.textContent = interim ? '… ' + interim : '';
        if (p >= model.flat.length) { active = false; stopRec(); mic.classList.remove('on'); mic.textContent = '🎤 Read again'; finish(); }
      };
      rec.onerror = function (e) { if (e.error !== 'no-speech' && e.error !== 'aborted') { srError(e.error); active = false; } };
      rec.onend = function () { if (active) { try { startOne(); } catch (er) { active = false; } } else { mic.classList.remove('on'); mic.textContent = '🎤 Read again'; } };
      rec.start();
    }
    try { startOne(); paint(); } catch (e) { srError('network'); active = false; mic.classList.remove('on'); }
  };
  return box;
}

/* ---------------------------------------------------------------- diagrams (built-in timelines) */
var DIAG = (function () {
  var W = 640, Y = 112;
  function axis() {
    return '<line class="dg-ax" x1="30" y1="' + Y + '" x2="610" y2="' + Y + '"/><polygon class="dg-axf" points="610,' + (Y - 6) + ' 622,' + Y + ' 610,' + (Y + 6) + '"/>' +
      '<line class="dg-now" x1="320" y1="28" x2="320" y2="' + (Y + 18) + '"/>' +
      '<text class="dg-lb" x="60" y="' + (Y + 34) + '">PAST</text><text class="dg-lb dg-nowt" x="320" y="' + (Y + 34) + '" text-anchor="middle">NOW</text><text class="dg-lb" x="590" y="' + (Y + 34) + '" text-anchor="end">FUTURE</text>';
  }
  function dot(x, cls) { return '<circle class="' + (cls || 'dg-dot') + '" cx="' + x + '" cy="' + Y + '" r="8"/>'; }
  function bar(x1, x2, cls) { return '<rect class="' + (cls || 'dg-bar') + '" x="' + x1 + '" y="' + (Y - 9) + '" width="' + (x2 - x1) + '" height="18" rx="3"/>'; }
  function txt(x, y, s, anchor, cls) { return '<text class="' + (cls || 'dg-t') + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + s + '</text>'; }
  function arrow(x1, x2, y, dashed) { return '<line class="dg-arr' + (dashed ? ' dg-dash' : '') + '" x1="' + x1 + '" y1="' + y + '" x2="' + (x2 - 8) + '" y2="' + y + '"/><polygon class="dg-arrh" points="' + (x2 - 10) + ',' + (y - 6) + ' ' + x2 + ',' + y + ' ' + (x2 - 10) + ',' + (y + 6) + '"/>'; }
  function person(x) { return '<g class="dg-person"><circle cx="' + x + '" cy="' + (Y - 52) + '" r="8"/><line x1="' + x + '" y1="' + (Y - 44) + '" x2="' + x + '" y2="' + (Y - 22) + '"/><line x1="' + (x - 10) + '" y1="' + (Y - 36) + '" x2="' + (x + 10) + '" y2="' + (Y - 36) + '"/><line x1="' + x + '" y1="' + (Y - 22) + '" x2="' + (x - 8) + '" y2="' + (Y - 12) + '"/><line x1="' + x + '" y1="' + (Y - 22) + '" x2="' + (x + 8) + '" y2="' + (Y - 12) + '"/></g>'; }
  function cross(x) { return '<g class="dg-x"><line x1="' + (x - 7) + '" y1="' + (Y - 7) + '" x2="' + (x + 7) + '" y2="' + (Y + 7) + '"/><line x1="' + (x + 7) + '" y1="' + (Y - 7) + '" x2="' + (x - 7) + '" y2="' + (Y + 7) + '"/></g>'; }
  var D = {
    'present-simple': function () { var s = ''; for (var x = 70; x <= 580; x += 51) s += dot(x); return [s + txt(320, 52, 'every day · usually · always'), 'Every day / habits: <b>I work</b> on Mondays. <b>She drinks</b> coffee every morning.']; },
    'now': function () { return ['<circle class="dg-pulse" cx="320" cy="' + Y + '" r="22"/>' + dot(320, 'dg-dot2') + txt(320, 52, 'happening right now: am / is / are + -ing'), 'Right now: <b>I’m working.</b> <b>She’s cooking</b> (at this moment).']; },
    'past': function () { return [dot(170, 'dg-dot') + txt(170, 72, 'yesterday · last week · in 2019') + cross(250) + txt(250, 140 + 14, 'finished', 'middle', 'dg-small'), 'Finished past, with a time: <b>I worked</b> yesterday. <b>We went</b> to Miami last week.']; },
    'going-to': function () { return [person(320) + '<rect class="dg-bub" x="336" y="20" width="140" height="30" rx="14"/>' + txt(406, 40, 'my plan!', 'middle', 'dg-small') + arrow(330, 470, Y - 30, true) + '<text class="dg-star" x="480" y="' + (Y + 7) + '" text-anchor="middle">★</text>' + txt(480, 160, 'tomorrow · next week', 'middle', 'dg-small'), 'A plan you already decided: <b>I’m going to call</b> her tonight. (Not “I call her tonight.”)']; },
    'will': function () { return ['<text class="dg-bolt" x="320" y="' + (Y - 24) + '" text-anchor="middle">⚡</text>' + txt(320, 46, 'decide now') + arrow(330, 462, Y, false) + dot(470, 'dg-dot2') + txt(470, 72, 'later'), 'Deciding right now, offers, promises: <b>I’ll get</b> it! <b>I’ll call</b> you later.']; },
    'present-perfect': function () { return [dot(110) + dot(170) + dot(235) + '<path class="dg-brace" d="M90 ' + (Y - 26) + ' Q 200 ' + (Y - 60) + ' 320 ' + (Y - 26) + '"/>' + txt(205, 40, 'sometime in your life, up to now') + arrow(250, 320, Y - 26, false), 'Life experience / past connected to now: <b>I’ve been</b> to Paris. <b>Have you ever tried</b> grits?']; },
    'for-since': function () { return [bar(130, 320) + '<line class="dg-flag" x1="130" y1="' + (Y - 40) + '" x2="130" y2="' + (Y - 9) + '"/><polygon class="dg-flagf" points="130,' + (Y - 40) + ' 156,' + (Y - 33) + ' 130,' + (Y - 26) + '"/>' + txt(130, 52, 'since 2024 (start)') + txt(225, Y + 5, 'for 2 years (how long)', 'middle', 'dg-in'), 'Started in the past and still true: <b>I’ve lived</b> here <b>for</b> two years / <b>since</b> 2024. (Not “I live here since…”.)']; },
    'past-continuous': function () { return [bar(80, 270) + txt(175, 60, 'was cooking… (long action)') + '<text class="dg-bolt" x="200" y="' + (Y + 6) + '" text-anchor="middle">⚡</text>' + txt(200, 160, 'when the phone rang', 'middle', 'dg-small'), 'A long action in the past, interrupted: <b>I was cooking</b> when the phone <b>rang</b>.']; },
    'past-perfect': function () { return [dot(110, 'dg-dot') + txt(110, 70, '1st: had left') + dot(240, 'dg-dot2') + txt(240, 70, '2nd: I arrived') + arrow(122, 228, Y - 22, false), 'The earlier past: When I <b>arrived</b>, the bus <b>had</b> already <b>left</b>.']; },
    'used-to': function () { var s = ''; for (var x = 60; x <= 210; x += 30) s += dot(x); return [s + '<line class="dg-stop" x1="238" y1="' + (Y - 26) + '" x2="238" y2="' + (Y + 26) + '"/>' + txt(135, 60, 'used to (back then)') + txt(285, 60, 'not anymore', 'middle', 'dg-small'), 'An old habit that stopped: I <b>used to smoke</b> (but I don’t now).']; },
    'if-real': function () { return [dot(320, 'dg-dot2') + '<path class="dg-arr" d="M330 ' + Y + ' Q 400 ' + (Y - 50) + ' 470 ' + (Y - 50) + '"/><path class="dg-arr dg-dash" d="M330 ' + Y + ' Q 400 ' + (Y + 40) + ' 470 ' + (Y + 40) + '"/>' + txt(530, Y - 46, 'if it rains →') + txt(530, Y - 28, 'we’ll stay home', 'middle', 'dg-small') + txt(520, Y + 46, 'if not → beach!', 'middle', 'dg-small'), 'A real possibility: <b>If it rains</b>, we<b>’ll stay</b> home. (No “will” after if.)']; },
    'if-unreal': function () { return ['<ellipse class="dg-cloud" cx="320" cy="48" rx="170" ry="30"/>' + txt(320, 44, 'imagine… (not true)') + txt(320, 62, 'If I were rich, I’d travel', 'middle', 'dg-small') + dot(320, 'dg-dot2') + txt(320, 160, 'reality: I’m not rich', 'middle', 'dg-small'), 'Imaginary / not true now: <b>If I had</b> more time, <b>I would</b> learn Spanish. (Never “if I would”.)']; }
  };
  return function (name) {
    var f = D[name]; if (!f) return '';
    var r = f();
    return '<figure class="diag"><svg viewBox="0 0 ' + W + ' 170" role="img" aria-label="' + esc(name) + ' timeline">' + axis() + r[0] + '</svg><figcaption>' + r[1] + '</figcaption></figure>';
  };
})();

/* ---------------------------------------------------------------- change events (screens subscribe to redraw the top bar etc.) */
var LISTENERS = {};
function on(ev, fn) { (LISTENERS[ev] = LISTENERS[ev] || []).push(fn); }
function emit(ev, data) { (LISTENERS[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
function header() { emit('change'); }

/* ---------------------------------------------------------------- points, ranks, streak, daily log (design values) */
var RANKS = [[0, 'Tourist'], [1000, 'Newcomer'], [2000, 'Local'], [3000, 'Floridian'], [5000, 'Tampa Native']];
var PTS = { item: { mcq: 2, pic: 2, type: 3, fix: 3, order: 3, listen: 3, cloze: 2 }, lesson: 80, stars3: 20, testOut: 50, review: 30, streak7: 100, write: 10, speak: 2, convo: 2, describe: 3 };
var DAILY_GOAL = 150;
function goal() { return (S && S.settings.goal) || DAILY_GOAL; }
function rankOf(xp) { var r = RANKS[0]; RANKS.forEach(function (x) { if (xp >= x[0]) r = x; }); return r; }
function rankIndex(xp) { var i = 0; RANKS.forEach(function (x, k) { if (xp >= x[0]) i = k; }); return i; }
function nextRank(xp) { for (var i = 0; i < RANKS.length; i++) if (RANKS[i][0] > xp) return RANKS[i]; return null; }
function dayLog(d) { d = d || dstr(); S.log = S.log || {}; return S.log[d] = S.log[d] || { xp: 0, sec: 0, n: 0 }; }
function touchDay() { var t = dstr(); if (S.day.d !== t) S.day = { d: t, xp: 0 }; dayLog(t); }
function streakNow() { return (S.streak.last === dstr() || S.streak.last === addDays(-1)) ? S.streak.n : 0; }
var SESSION_XP = null;
function addXP(n, why) {
  if (!n) return; touchDay();
  var before = rankIndex(S.xp);
  S.xp += n; S.day.xp += n; dayLog().xp += n;
  var t = dstr();
  if (S.streak.last !== t) {
    S.streak.n = (S.streak.last === addDays(-1)) ? S.streak.n + 1 : 1; S.streak.last = t;
    S.streak.best = Math.max(S.streak.best || 0, S.streak.n);
    if (S.streak.n % 7 === 0) { S.xp += PTS.streak7; S.day.xp += PTS.streak7; dayLog().xp += PTS.streak7; toast(S.streak.n + '-day streak! +' + PTS.streak7 + ' pts'); }
  }
  if (rankIndex(S.xp) > before) toast('New rank: ' + rankOf(S.xp)[1] + '!');
  if (SESSION_XP) SESSION_XP.n += n;
  save(); header();
}
/* active-time heartbeat for the practice calendar (counts seconds while she is actually using the site) */
var LAST_ACT = 0;
['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { LAST_ACT = Date.now(); }, true); });
setInterval(function () {
  if (!S || document.hidden || Date.now() - LAST_ACT > 90000) return;
  touchDay(); dayLog().sec += 15;
  if (dayLog().sec % 60 === 0) save();
}, 15000);
function minutesOn(d) { var l = (S.log || {})[d]; return l ? Math.round(l.sec / 60) : 0; }
function daysPracticed(prefix) { return Object.keys(S.log || {}).filter(function (d) { return (!prefix || d.indexOf(prefix) === 0) && (S.log[d].xp > 0 || S.log[d].sec >= 60); }).length; }

/* ---------------------------------------------------------------- spaced repetition for questions (adaptive) */
var GAPS = [0, 1, 3, 7, 14, 30, 60];
function recordItem(id, ok) {
  if (!id) return;
  var r = S.items[id] || { box: 0, due: dstr(), right: 0, wrong: 0, lapses: 0 };
  if (ok) { r.box = Math.min(6, r.box + 1); r.right++; r.streak = (r.streak || 0) + 1; }
  else { r.box = 1; r.wrong++; r.streak = 0; r.lastMiss = dstr(); if (r.right) r.lapses = (r.lapses || 0) + 1; }
  r.due = addDays(ok ? GAPS[r.box] : 0); r.seen = dstr();
  S.items[id] = r; save();
}
/* how much an item needs practice: missed often + missed recently + overdue */
function itemPriority(id) {
  var r = S.items[id]; if (!r) return 0;
  var overdue = r.due <= dstr() ? 1 : 0;
  var recent = r.lastMiss && r.lastMiss >= addDays(-3) ? 2 : 0;
  return r.wrong * 3 + (r.lapses || 0) * 2 + recent + overdue - (r.streak || 0) * 1.5;
}
function dueItems() {
  var t = dstr();
  return Object.keys(S.items).filter(function (id) { return ITEMS[id] && lidVisible(ITEMS[id].lid) && S.items[id].due <= t && S.items[id].box < 6; })
    .sort(function (a, b) { return itemPriority(b) - itemPriority(a); });
}
function troubleItems(n) {
  return Object.keys(S.items).filter(function (id) { return ITEMS[id] && lidVisible(ITEMS[id].lid) && S.items[id].wrong > 0 && (S.items[id].streak || 0) < 3; })
    .sort(function (a, b) { return itemPriority(b) - itemPriority(a); }).slice(0, n || 99);
}

/* ---------------------------------------------------------------- Anki-style cards (words + phrases), SM-2 lite */
/* card ids: 'w:<wordId>' (lesson words) or 'p:<index>' (phrasebook) */
function cardData(cid) {
  if (cid.indexOf('w:') === 0) { var w = WORDMAP[cid.slice(2)]; return w ? { term: w.w.w, fr: w.w.fr, def: w.w.def, ex: w.w.ex, img: w.w.img, lid: w.lid, kind: 'word' } : null; }
  if (cid.indexOf('p:') === 0) { var p = ENG.phrases[+cid.slice(2)]; return p ? { term: p.en, fr: p.fr, def: p.note, ex: p.reply ? '“' + p.en + '” “' + p.reply + '”' : '', img: p.img, cat: p.cat, kind: 'phrase' } : null; }
  return null;
}
function cardState(cid) { return S.cards[cid] || null; }
function rateCard(cid, g) { /* g: 0 again, 1 hard, 2 good, 3 easy */
  var c = S.cards[cid] || { ivl: 0, ease: 2.5, reps: 0, lapses: 0 };
  var now = Date.now();
  if (g === 0) { c.reps = 0; c.lapses++; c.ivl = 0; c.ease = Math.max(1.3, c.ease - 0.2); c.dueAt = now + 60 * 1000; }
  else {
    if (c.reps === 0) c.ivl = g === 1 ? 1 : g === 2 ? 1 : 3;
    else if (c.reps === 1) c.ivl = g === 1 ? 2 : g === 2 ? 3 : 6;
    else c.ivl = Math.round(c.ivl * (g === 1 ? 1.2 : g === 2 ? c.ease : c.ease * 1.3));
    c.ease = Math.max(1.3, c.ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0));
    c.reps++; c.dueAt = now + c.ivl * 86400000;
  }
  c.last = dstr(); c.seen = (c.seen || 0) + 1; S.cards[cid] = c; save();
  return c;
}
function cardPreview(cid) { /* labels for the 4 buttons */
  var c = S.cards[cid] || { ivl: 0, ease: 2.5, reps: 0 };
  function lab(d) { return d < 1 ? '1 min' : d === 1 ? '1 day' : d < 30 ? d + ' days' : Math.round(d / 30) + ' mo'; }
  var hard = c.reps === 0 ? 1 : c.reps === 1 ? 2 : Math.round(c.ivl * 1.2), good = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.ivl * c.ease), easy = c.reps === 0 ? 3 : c.reps === 1 ? 6 : Math.round(c.ivl * c.ease * 1.3);
  return [lab(0), lab(Math.max(1, hard)), lab(Math.max(1, good)), lab(Math.max(2, easy))];
}
function mastery(cid) { /* 0..5 bars + label */
  var c = S.cards[cid], wid = cid.indexOf('w:') === 0 ? cid.slice(2) : null, wr = wid ? (S.words[wid] || 0) : 0;
  var lvl = 0;
  if (c) lvl = c.reps >= 5 || c.ivl >= 21 ? 5 : c.reps >= 3 ? 4 : c.reps >= 2 ? 3 : c.reps >= 1 ? 2 : 1;
  lvl = Math.max(lvl, Math.min(4, wr));
  return { n: lvl, label: ['New', 'Seen once', 'Getting there', 'Learning', 'Almost', 'Mastered'][lvl] };
}
/* cards she has met (words of lessons she started + saved phrases), due first, most-missed first */
function dueCards(limit) {
  var now = Date.now(), out = [];
  WORDS.forEach(function (w) { if (!lidVisible(w.lid)) return; var started = isDone(w.lid) || S.prog[w.lid]; if (!started) return; out.push('w:' + w.id); });
  Object.keys(S.saved || {}).forEach(function (k) { if (S.saved[k] && out.indexOf(k) < 0) out.push(k); });
  out = out.filter(function (cid) { var c = S.cards[cid]; return !c || (c.dueAt || 0) <= now; });
  out.sort(function (a, b) { var A = S.cards[a], B = S.cards[b]; var pa = A ? (A.lapses || 0) * 3 + 2 : 1, pb = B ? (B.lapses || 0) * 3 + 2 : 1; return pb - pa; });
  return out.slice(0, limit || 20);
}
function saveCard(cid, on) { S.saved = S.saved || {}; if (on === false) delete S.saved[cid]; else S.saved[cid] = dstr(); save(); }

/* ---------------------------------------------------------------- lesson state + test-out */
function isKnew(lid) { return !!(S.lessons[lid] && S.lessons[lid].knewIt); }
function lessonState(lid) {
  var st = S.lessons[lid] || {}, p = pct(lid);
  if (st.done && st.knewIt && !st.played) return { state: 'knew', pct: 100, score: st.score, stars: 0, label: 'Tested out · ' + (st.score || 0) + '%' };
  if (st.done) return { state: 'finished', pct: 100, stars: st.stars || 1, label: 'Finished' };
  if (p > 0) return { state: 'progress', pct: p, step: (S.prog[lid] || {}).max || 0, label: p + '% · continue' };
  return { state: 'new', pct: 0, label: 'Start · Test out' };
}
function levelPct(lv) { var ids = lv.lessons.map(function (l) { return l.id; }); return Math.round(ids.reduce(function (a, id) { return a + pct(id); }, 0) / Math.max(1, ids.length)); }
function levelKnewPct(lv) { var ids = lv.lessons.map(function (l) { return l.id; }); return Math.round(ids.filter(isKnew).length / Math.max(1, ids.length) * 100); }
function gradedOf(list) { return list.filter(function (id) { return GRADED[ITEMS[id].item.k]; }); }
/* test items for one lesson: the lesson check first, then practice, then quick checks */
function lessonTestItems(lid, n) {
  n = n || 10;
  var ids = Object.keys(ITEMS).filter(function (id) { return ITEMS[id].lid === lid; });
  var fin = shuffle(ids.filter(function (id) { return ITEMS[id].final; })), rest = shuffle(ids.filter(function (id) { return !ITEMS[id].final; }));
  return fin.concat(rest).slice(0, n);
}
function levelTestItems(lv, perLesson) {
  var out = []; lv.lessons.forEach(function (l) { out = out.concat(lessonTestItems(l.id, perLesson || 3)); });
  return shuffle(out);
}
function markKnew(lid, score) {
  var prev = S.lessons[lid] || {};
  if (prev.done && !prev.knewIt) { prev.testScore = score; S.lessons[lid] = prev; save(); return; }
  S.lessons[lid] = { done: true, knewIt: true, score: score, stars: 0, date: dstr() };
  addXP(PTS.testOut, 'testout');
}
function finishLessonState(lid, acc) {
  var stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1, prev = S.lessons[lid] || {};
  var first = !prev.done || prev.knewIt;
  S.lessons[lid] = { done: true, stars: Math.max(stars, prev.knewIt ? 0 : (prev.stars || 0)), best: Math.max(acc, prev.best || 0), date: dstr(), runs: (prev.runs || 0) + 1, played: true };
  delete S.pos[lid]; if (S.prog[lid]) S.prog[lid].max = LESSONS[lid].lesson.steps.length;
  var pts = 0;
  if (first) pts += PTS.lesson;
  if (stars === 3 && (prev.stars || 0) < 3) pts += PTS.stars3;
  addXP(pts, 'lesson'); save();
  return { stars: stars, pts: pts };
}

/* ---------------------------------------------------------------- skill balance (0-100, from real activity) */
var SKILL_OF = { listen: 'Listening', type: 'Grammar', fix: 'Grammar', order: 'Grammar', mcq: 'Words', pic: 'Words', cloze: 'Words' };
function skills() {
  var acc = {}, add = function (k, ok) { acc[k] = acc[k] || { r: 0, n: 0 }; acc[k].n++; if (ok) acc[k].r++; };
  Object.keys(S.items).forEach(function (id) {
    var x = ITEMS[id]; if (!x) return; var r = S.items[id], sk = SKILL_OF[x.item.k] || 'Grammar';
    var st = x.lid && LESSONS[x.lid] ? LESSONS[x.lid].lesson.steps[x.si] : null;
    if (st && st.type === 'read') sk = 'Reading';
    for (var i = 0; i < Math.min(3, r.right); i++) add(sk, true);
    for (var j = 0; j < Math.min(3, r.wrong); j++) add(sk, false);
  });
  function score(k, volume) { var a = acc[k]; if (!a) return 0; return Math.round(Math.min(100, (a.r / a.n) * 60 + Math.min(40, a.n / (volume || 4)))); }
  var spoken = Object.keys(S.spoken || {}).length, writes = Object.keys(S.writes || {}).filter(function (k) { return words(S.writes[k]) > 10; }).length;
  var learned = Object.keys(S.words || {}).filter(function (k) { return S.words[k] >= 2; }).length + Object.keys(S.cards || {}).filter(function (k) { return S.cards[k].reps >= 2; }).length;
  var culture = 0, convo = 0;
  Object.keys(S.prog || {}).concat(Object.keys(S.lessons || {})).forEach(function (lid) { var L = LESSONS[lid]; if (!L) return; L.lesson.steps.forEach(function (s, i) { if (i <= ((S.prog[lid] || {}).max || (isDone(lid) ? 99 : -1))) { if (s.type === 'culture') culture++; if (s.type === 'convo' || s.type === 'dialogue') convo++; } }); });
  return [
    ['Sounds', Math.min(100, spoken * 4)],
    ['Grammar', score('Grammar', 6)],
    ['Words', Math.min(100, Math.round(score('Words', 6) * 0.6 + Math.min(40, learned / 5)))],
    ['Reading', score('Reading', 2)],
    ['Listening', score('Listening', 2)],
    ['Conversation', Math.min(100, convo * 4 + spoken)],
    ['Writing', Math.min(100, writes * 8)],
    ['American life', Math.min(100, culture * 6 + (ORDER.path || []).filter(isDone).length * 3)]
  ];
}

/* ---------------------------------------------------------------- sticker book */
var STICKER_COLORS = ['rose', 'sage', 'lavender', 'peach', 'gold'];
function stickers() {
  var out = [], k = 0;
  function add(id, label, got) { out.push({ id: id, label: label, got: !!got, color: STICKER_COLORS[k++ % STICKER_COLORS.length] }); }
  add('first', 'First lesson', Object.keys(S.lessons).filter(isDone).length >= 1);
  add('streak7', '7 days', (S.streak.best || S.streak.n) >= 7);
  add('words100', '100 words', Object.keys(S.words).filter(function (x) { return S.words[x] >= 2; }).length + Object.keys(S.cards).filter(function (x) { return S.cards[x].reps >= 2; }).length >= 100);
  add('chat', '1st chat', Object.keys(S.prog).some(function (l) { var L = LESSONS[l]; return L && L.lesson.steps.some(function (s, i) { return s.type === 'convo' && i < (S.prog[l].max || 0); }); }));
  add('speak', '1st speech', Object.keys(S.spoken || {}).length > 0);
  add('testout', 'Tested out', Object.keys(S.lessons).some(isKnew));
  add('writer', 'Writer', Object.keys(S.writes || {}).filter(function (x) { return words(S.writes[x]) > 25; }).length >= 3);
  add('streak30', '30 days', (S.streak.best || 0) >= 30);
  (ENG.courses.path ? ENG.courses.path.levels : []).forEach(function (lv, i) { add('lvl' + (i + 1), 'Level ' + (i + 1), lv.lessons.every(function (l) { return isDone(l.id); })); });
  (ENG.courses.school ? ENG.courses.school.levels : []).forEach(function (lv, i) { add('gr' + (i + 1), 'Grade ' + (i + 1), lv.lessons.every(function (l) { return isDone(l.id); })); });
  (ORDER.path || []).forEach(function (lid) { var L = LESSONS[lid]; add('l:' + lid, L.lesson.short || L.lesson.title.split(/[,:!?—]/)[0].slice(0, 14), isDone(lid)); });
  return out;
}

/* ---------------------------------------------------------------- learning plan (sequence) */
/* ENG.plan: an ordered list of lesson ids (content/plan.js). Falls back to Foundations + Life in Tampa interleaved. */
function planList() {
  if (ENG.plan && ENG.plan.length) return ENG.plan.filter(function (id) { return LESSONS[id] && lidVisible(id); });
  var a = ORDER.school || [], b = ORDER.path || [], out = [], i = 0;
  while (i < Math.max(a.length, b.length)) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); i++; }
  return out;
}
function planNext() {
  var cur = null, bt = '';
  Object.keys(S.prog).forEach(function (lid) { if (LESSONS[lid] && lidVisible(lid) && !isDone(lid) && (S.prog[lid].t || '') >= bt) { bt = S.prog[lid].t || ''; cur = lid; } });
  if (cur) return cur;
  var pl = planList(); for (var i = 0; i < pl.length; i++) if (!isDone(pl[i])) return pl[i];
  return null;
}

/* ---------------------------------------------------------------- French help (default on) */
function frOn() { return !S || S.settings.frenchHelp !== false; }
function setFrench(on) { S.settings.frenchHelp = !!on; save(); document.documentElement.classList.toggle('fr-off', !on); emit('change'); }
/* the French line that sits under English (hidden by CSS when French help is off) */
function frLine(fr, cls) { return fr ? '<div class="fr-line ' + (cls || '') + '">' + esc(fr) + '</div>' : ''; }

/* ---------------------------------------------------------------- tiny router registry (screens register themselves) */
var ROUTES = {};
function route(name, fn) { ROUTES[name] = fn; }
function go(h) { if (location.hash === h) dispatch(); else location.hash = h; }
function bindGo(root) { $$('[data-go]', root || document).forEach(function (b) { if (b._go) return; b._go = 1; b.addEventListener('click', function (e) { e.preventDefault(); go(b.getAttribute('data-go')); }); }); }
function dispatch() {
  stopSpeech(); stopRec(); hideTip(); SESSION_XP = null;
  var h = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent), name = h[0] || 'home';
  var fn = ROUTES[name] || ROUTES.home;
  var main = $('#main'); main.innerHTML = '';
  emit('route', { name: name, args: h.slice(1) });
  if (fn) fn(main, h.slice(1));
  window.scrollTo(0, 0); header();
}
/* ---------------------------------------------------------------- lesson status (no locks: everything is open) */
function isDone(lid) { return !!(S.lessons[lid] && S.lessons[lid].done); }
function levelDone(lv) { return lv.lessons.every(function (l) { return isDone(l.id); }); }
function pct(lid) {
  if (isDone(lid)) return 100;
  var L = LESSONS[lid], p = S.prog[lid]; if (!L || !p) return 0;
  return Math.min(99, Math.round((p.max || 0) / L.lesson.steps.length * 100));
}
function starsHTML(n) { var h = ''; for (var i = 1; i <= 3; i++) h += i <= n ? '★' : '<span class="off">★</span>'; return h; }
function currentLesson(cid) {
  var best = null, bt = '';
  Object.keys(S.prog).forEach(function (lid) { if (LESSONS[lid] && LESSONS[lid].course.id === cid && !isDone(lid) && (S.prog[lid].t || '') >= bt) { bt = S.prog[lid].t || ''; best = lid; } });
  if (best) return best;
  var ord = ORDER[cid] || [];
  for (var i = 0; i < ord.length; i++) if (!isDone(ord[i])) return ord[i];
  return null;
}
function unitWord(c) { return c.id === 'school' ? 'Unit' : 'Lesson'; }
function levelLabel(c, lv, li) {
  if (c.id === 'school') return /^grade/i.test(lv.title) ? '' : 'Grade ' + (li + 1) + ': ';
  if (c.id === 'path') return 'Level ' + (li + 1) + ': ';
  return '';
}

/* ---------------------------------------------------------------- multi-item practice page */
var XP = PTS.item;
var GROUPS = [['mcq', '🔘 Choose the answer'], ['pic', '🖼️ Choose the photo'], ['type', '✏️ Fill in the blank'], ['fix', '🛠️ Fix the mistake'], ['order', '🧩 Put the words in order'], ['listen', '🎧 Listen and type'], ['describe', '📸 Describe the photo']];
var PRAISE = ['✓ Correct!', '✓ Nice!', '✓ Exactly!', '✓ You got it!', '✓ Perfect!', '✓ Great job!'];
function itemsPage(container, list, opt) {
  opt = opt || {};
  list = list.filter(function (x) { return x.it; });
  var done = 0, right = 0, missed = [];
  var bar = null;
  if (!opt.compact) { bar = el('<div class="scorebar"><b class="sb-a">0 / ' + list.length + ' answered</b><div class="pbar"><i style="width:0"></i></div><b class="sb-r" style="color:var(--ok)">✓ 0</b></div>'); container.appendChild(bar); }
  var body = el('<div></div>'); container.appendChild(body);
  var ordered = list;
  if (opt.group) {
    ordered = [];
    GROUPS.forEach(function (g) { var xs = list.filter(function (x) { return x.it.k === g[0]; }); if (xs.length) { ordered.push({ head: g[1] }); ordered = ordered.concat(xs); } });
  }
  var num = 0;
  ordered.forEach(function (x) {
    if (x.head) { body.appendChild(el('<div class="ghead">' + x.head + '</div>')); return; }
    num++;
    var card = itemCard(x.it, num, { gloss: x.gloss, id: x.id, retry: opt.retry, done: function (res) {
      done++; if (res.first) right++; else if (GRADED[x.it.k]) missed.push(x);
      if (opt.onResult) opt.onResult(x.it, { first: res.first, retry: opt.retry });
      if (bar) { $('.sb-a', bar).textContent = done + ' / ' + list.length + ' answered'; $('.pbar i', bar).style.width = (done / list.length * 100) + '%'; $('.sb-r', bar).textContent = '✓ ' + right; }
      if (done === list.length) allDone();
    } });
    body.appendChild(card);
  });
  function allDone() {
    var sum = el('<div class="card summary"></div>');
    var graded = list.filter(function (x) { return GRADED[x.it.k]; }).length;
    sum.innerHTML = '<b>' + (missed.length ? '👍 Done! ' + right + ' of ' + list.length + ' right the first time.' : '🎉 Perfect! Everything right.') + '</b>' +
      (missed.length ? '<p class="sub" style="margin:6px 0 10px">Practice makes perfect: try the ones you missed again.</p><button class="btn sm" id="retry">🔁 Try the ' + missed.length + ' missed one' + (missed.length > 1 ? 's' : '') + ' again</button>' : '');
    if (!opt.compact || missed.length) container.appendChild(sum);
    var r = $('#retry', sum);
    if (r) r.onclick = function () { r.remove(); var box = el('<div style="margin-top:12px"></div>'); sum.appendChild(box); itemsPage(box, missed.map(function (m) { return { it: m.it, id: null, gloss: m.gloss }; }), { group: false, compact: true, retry: true }); };
    if (opt.onAllDone) opt.onAllDone({ right: right, total: list.length, graded: graded, missed: missed });
  }
  if (!list.length && opt.onAllDone) opt.onAllDone({ right: 0, total: 0, missed: [] });
  return { body: body };
}
function itemCard(it, num, o) {
  var card = el('<div class="icard"></div>'), finished = false;
  function finish(first, xp, cls) {
    if (finished) return; finished = true;
    if (o.id && GRADED[it.k]) recordItem(o.id, first);
    if (xp) addXP(card.getAttribute('data-hinted') ? Math.ceil(xp / 2) : xp);
    card.classList.add(cls || (first ? 'ok' : 'no'));
    o.done({ first: first });
  }
  function why() { return it.why ? '<span class="why">' + fmt(it.why) + '</span>' : ''; }
  var hint = it.fr ? '<div class="hintrow">' + '<button class="frbtn" data-fr="' + esc(it.fr) + '" data-hint="1">🇫🇷 Indice</button></div>' : '';
  var h = '';
  if (it.img && it.k !== 'describe' && imgRec(it.img)) h += imgHTML(it.img, 'qimg');
  if (it.k === 'listen') h += '<div class="q">' + num + '. Listen and type what you hear. <button class="btn sm" data-play="1">🔊 Play</button> <button class="btn sm" data-play="slow">🐢 Slow</button></div>';
  else h += '<div class="q">' + num + '. ' + fmt(it.q || (it.k === 'fix' ? 'Fix the mistake.' : it.k === 'describe' ? 'Describe the photo.' : '')) + '</div>';
  if (it.k === 'fix') h += '<div class="qbad nogloss">✗ ' + esc(it.s) + '</div>';
  card.innerHTML = h + '<div class="ia"></div><div class="ifb"></div>' + hint;
  var ia = $('.ia', card), ifb = $('.ifb', card);
  if (it.k === 'mcq' || it.k === 'pic') {
    var opts = shuffle(it.opts.map(function (x, k) { return k; }));
    var picOK = it.k === 'pic' && it.opts.every(imgRec);
    if (it.k === 'mcq' || !picOK) ia.innerHTML = '<div class="opts">' + opts.map(function (k) { return '<button class="opt" data-k="' + k + '">' + (it.k === 'pic' ? esc(ENG.imgq[it.opts[k]] || it.opts[k]) : fmt(it.opts[k])) + '</button>'; }).join('') + '</div>';
    else ia.innerHTML = '<div class="picopts">' + opts.map(function (k) { return '<button class="picopt" data-k="' + k + '">' + imgHTML(it.opts[k]) + '</button>'; }).join('') + '</div>';
    var bs = $$('[data-k]', ia);
    bs.forEach(function (b) {
      b.onclick = function () {
        var ok = +b.getAttribute('data-k') === it.a;
        bs.forEach(function (x) { x.disabled = true; if (+x.getAttribute('data-k') === it.a) x.classList.add('ok'); });
        if (!ok) b.classList.add('no');
        ifb.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? pick(PRAISE) : 'Not quite: the right answer is in green.') + '</b>' + why() + '</div>';
        applyGloss(ifb, o.gloss);
        finish(ok, ok ? XP[it.k] : 0);
      };
    });
  } else if (it.k === 'type' || it.k === 'fix' || it.k === 'listen') {
    ia.innerHTML = '<div class="irow"><input class="tin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (it.k === 'fix' ? 'Write the correct sentence…' : 'Type your answer…') + '"><button class="btn">Check</button></div>';
    var inp = $('input', ia), cb = $('button', ia), tries = 0;
    if (it.k === 'listen') $$('[data-play]', card).forEach(function (b) { b.onclick = function () { speak(it.say, { slow: b.getAttribute('data-play') === 'slow' }); inp.focus(); }; });
    var check = function () {
      if (!inp.value.trim() || finished) return;
      var r = C.checkAnswer(inp.value, it.a, it.k === 'fix' ? it.s : null); tries++;
      if (r.ok) {
        inp.classList.add('ok'); inp.disabled = true; cb.disabled = true;
        ifb.innerHTML = '<div class="fb ok"><b>' + (r.typo ? '✓ Correct! Small spelling slip: “' + esc(plain(r.best)) + '”' : pick(PRAISE)) + '</b>' + why() + '</div>';
        applyGloss(ifb, o.gloss);
        finish(tries === 1, tries === 1 ? XP[it.k] : 5, tries === 1 ? 'ok' : 'info');
      } else if (tries === 1) {
        inp.classList.add('no'); setTimeout(function () { inp.classList.remove('no'); }, 600);
        ifb.innerHTML = '<div class="fb warn"><b>' + (r.same ? 'That’s the same sentence. Find the mistake and change it!' : 'Almost! Try once more.') + '</b></div>';
        inp.focus();
      } else {
        inp.classList.add('no'); inp.disabled = true; cb.disabled = true;
        ifb.innerHTML = '<div class="fb no"><b>Answer: “' + esc(plain(arr(it.a)[0])) + '”</b> ' + sayBtn(arr(it.a)[0]) + why() + '</div>';
        applyGloss(ifb, o.gloss); finish(false, 0);
      }
    };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } };
    cb.onclick = check;
  } else if (it.k === 'order') {
    var target = typeof it.a === 'string' ? it.a : arr(it.a)[0];
    var tiles = shuffle((it.words || []).concat(it.extra || []).map(function (w, k) { return { w: w, k: k }; }));
    var chosen = [], otries = 0;
    ia.innerHTML = '<div class="tray"><span class="sub" style="margin:0;font-size:13px">Tap the words in order</span></div><div class="row"><div class="bank" style="flex:1">' + tiles.map(function (t) { return '<button class="wtile" data-t="' + t.k + '">' + esc(t.w) + '</button>'; }).join('') + '</div><button class="btn" data-chk="1" disabled>Check</button></div>';
    var tray = $('.tray', ia), bank = $('.bank', ia), ob = $('[data-chk]', ia);
    var redraw = function () {
      tray.innerHTML = chosen.length ? chosen.map(function (t, n) { return '<button class="wtile" data-n="' + n + '">' + esc(t.w) + '</button>'; }).join('') : '<span class="sub" style="margin:0;font-size:13px">Tap the words in order</span>';
      $$('[data-n]', tray).forEach(function (b) { b.onclick = function () { if (finished) return; var t = chosen.splice(+b.getAttribute('data-n'), 1)[0]; $('[data-t="' + t.k + '"]', bank).classList.remove('used'); redraw(); }; });
      ob.disabled = !chosen.length || finished;
    };
    $$('[data-t]', bank).forEach(function (b) { b.onclick = function () { if (finished || b.classList.contains('used')) return; b.classList.add('used'); chosen.push(tiles.filter(function (t) { return t.k === +b.getAttribute('data-t'); })[0]); redraw(); }; });
    ob.onclick = function () {
      var said = chosen.map(function (t) { return t.w; }).join(' '), ok = C.norm(said) === C.norm(target); otries++;
      if (ok) { tray.classList.add('ok'); ifb.innerHTML = '<div class="fb ok"><b>' + pick(PRAISE) + '</b> ' + sayBtn(target) + why() + '</div>'; finish(otries === 1, otries === 1 ? XP.order : 5, otries === 1 ? 'ok' : 'info'); ob.disabled = true; }
      else if (otries === 1) { tray.classList.add('no'); setTimeout(function () { tray.classList.remove('no'); }, 600); ifb.innerHTML = '<div class="fb warn"><b>Almost! Tap a word in the top line to move it back, then try again.</b></div>'; }
      else { tray.classList.add('no'); ifb.innerHTML = '<div class="fb no"><b>Answer: “' + esc(target) + '”</b> ' + sayBtn(target) + why() + '</div>'; finish(false, 0); ob.disabled = true; }
    };
  } else if (it.k === 'describe') {
    ia.innerHTML = imgHTML(it.img, 'qimg') + '<textarea class="tin" style="min-height:80px" placeholder="Write 1–2 sentences… (there are no wrong answers)"></textarea><div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn">Check</button></div>';
    var dtx = $('textarea', ia), db = $('.btn', ia), got = false;
    db.onclick = function () {
      var text = dtx.value.trim(); if (words(text) < 2) { toast('Write a sentence first'); return; }
      var needs = it.need || [], hits = C.ideasHit(text, needs), all = hits.every(Boolean);
      ifb.innerHTML = '<div class="fb ' + (all ? 'ok' : 'info') + '"><b>' + (all ? '🎉 Great description!' : '👍 Good try! Can you add a bit more?') + '</b>' +
        (needs.length ? '<span class="why">Ideas we looked for:</span><div class="need">' + needs.map(function (g, k) { return '<span class="' + (hits[k] ? 'hit' : '') + '">' + (hits[k] ? '✓ ' : '○ ') + esc(g.slice(0, 3).join(' / ')) + '</span>'; }).join('') + '</div>' : '') + why() + '</div>';
      ifb.appendChild(feedbackBlock(text, { model: it.model }));
      if (!got) { got = true; finish(true, all ? 15 : 10, all ? 'ok' : 'info'); }
    };
  }
  applyGloss(card, o.gloss);
  return card;
}


/* ---------------------------------------------------------------- UI kit shared by all screens (design atoms) */
var ui = {
  /* conic progress ring: pct 0-100, size px, inner label html; opt.color, opt.lav (lavender pct), opt.th thickness */
  ring: function (pct, size, label, opt) {
    opt = opt || {}; size = size || 60; var th = opt.th || Math.max(5, Math.round(size / 11));
    var c = opt.color || 'var(--rose)', lav = opt.lav || 0, p = Math.max(0, Math.min(100, pct || 0));
    var bg = lav ? 'conic-gradient(var(--lavender) 0 ' + lav + '%, ' + c + ' ' + lav + '% ' + Math.max(lav, p) + '%, var(--track) 0)' : 'conic-gradient(' + c + ' 0 ' + p + '%, var(--track) 0)';
    return '<span class="ring" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + ';--th:' + th + 'px"><span class="in">' + (label || '') + '</span></span>';
  },
  /* photo circle with a lesson-state ring */
  stateRing: function (lid, size, imgKey) {
    var st = lessonState(lid), L = LESSONS[lid], key = imgKey || (L && L.lesson.img);
    var im = imgRec(key);
    var inner = im ? '<div class="ph' + illusCls(im) + '"><img loading="lazy" alt="" src="' + esc(im.u) + '"></div>' : '<div class="noimg">' + esc(String(key || (L ? L.lesson.title : '')).replace(/_/g, ' ').slice(0, 24)) + '</div>';
    return '<div class="sring ' + st.state + '" style="width:' + size + 'px;height:' + size + 'px">' + inner + '</div>';
  },
  segs: function (n, done, cur) { var h = '<div class="segs">'; for (var i = 0; i < n; i++) h += '<i class="' + (i < done ? 'done' : i === cur ? 'cur' : '') + '"></i>'; return h + '</div>'; },
  stars: function (n) { var h = '<span class="stars">'; for (var i = 1; i <= 3; i++) h += i <= n ? '★' : '<span class="off">★</span>'; return h + '</span>'; },
  stateTag: function (lid) { var st = lessonState(lid); return st.state === 'finished' ? '<span class="statetag">' + '★'.repeat(st.stars || 1) + '</span>' : st.state === 'knew' ? '<span class="statetag knew">Knew it</span>' : st.state === 'progress' ? '<span class="statetag progress">You are here</span>' : ''; },
  photo: function (key, cls, label) { var im = imgRec(key); return im ? '<div class="ph ' + (cls || '') + illusCls(im) + '"><img loading="lazy" alt="" src="' + esc(im.u) + '"></div>' : '<div class="ph stripe ' + (cls || '') + '"><span>' + esc(label || String(key || '').replace(/^[a-z]\d?_/, '').replace(/_/g, ' ')) + '</span></div>'; },
  /* estimated minutes for a step (for step lists) */
  stepMinutes: function (st) { var m = { words: 7, learn: 5, dialogue: 3, teach: 7, culture: 2, rule: 4, quiz: 6, convo: 5, read: 4, write: 5, speak: 3 }[st.type] || 3; if (st.type === 'quiz') m = Math.max(3, Math.round((st.items || []).length / 4)); return m; },
  stepName: function (ls, i) { var st = ls.steps[i]; if (st.type === 'quiz' && i === ls.steps.length - 1) return 'Quick check'; return { words: 'New words', learn: 'Key phrases', dialogue: 'See it in use', teach: 'Lesson', culture: 'Culture note', rule: 'Lesson', quiz: 'Practice', convo: 'Conversation', read: 'Reading', write: 'Writing', speak: 'Speaking (optional)' }[st.type] || st.type; }
};


/* ---------------------------------------------------------------- backup file in the site folder (survives clearing the browser)
   Chrome/Edge: she connects the folder site/progress once; every save also writes
   progress-backup.js (loaded by index.html at startup) + progress-backup.json there.
   Other browsers: "Download a backup" saves progress-backup.js; put it in site/progress. */
function backupJS(json) { return '/* Sunshine English progress backup. Keep this file in site/progress/. */\nwindow.SE_BACKUP = ' + json + ';\n'; }
function writeBackupFolder(json) {
  if (!DIRH) return;
  var write = function (name, text) { return DIRH.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(text).then(function () { return w.close(); }); }); };
  write('progress-backup.js', backupJS(json)).then(function () { return write('progress-backup.json', json); })
    .then(function () { DIRSTATE = 'ok'; S.lastBackup = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} emit('backup'); })
    .catch(function () { DIRSTATE = 'needs-permission'; emit('backup'); });
}
function backupSupported() { return !!window.showDirectoryPicker; }
function connectBackupFolder() {
  if (!window.showDirectoryPicker) { DIRSTATE = 'unsupported'; return Promise.resolve(false); }
  return window.showDirectoryPicker({ id: 'se-progress', mode: 'readwrite' }).then(function (h) {
    DIRH = h; DIRSTATE = 'ok'; idbPut('dirHandle', h); writeBackupFolder(JSON.stringify(S)); toast('Backup folder connected: progress now saves into ' + h.name); return true;
  }).catch(function () { return false; });
}
function resumeBackupFolder() { /* needs a click (browser rule) when permission expired */
  if (!DIRH || !DIRH.requestPermission) return Promise.resolve(false);
  return DIRH.requestPermission({ mode: 'readwrite' }).then(function (p) { DIRSTATE = p === 'granted' ? 'ok' : 'needs-permission'; if (p === 'granted') writeBackupFolder(JSON.stringify(S)); emit('backup'); return p === 'granted'; });
}
function downloadBackup() {
  var json = JSON.stringify(S), a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([backupJS(json)], { type: 'application/javascript' }));
  a.download = 'progress-backup.js'; document.body.appendChild(a); a.click(); a.remove();
  S.lastDownload = Date.now(); save();
}
function loadBackupText(text) {
  var m = String(text).match(/window\.SE_BACKUP\s*=\s*([\s\S]*);\s*$/), json = m ? m[1] : text;
  var o = JSON.parse(json); if (!o || typeof o !== 'object' || o.xp == null) throw new Error('not a backup');
  importState(JSON.stringify(o)); toast('Progress loaded from your backup');
}
function backupStatus() {
  return { supported: backupSupported(), state: DIRH ? DIRSTATE : (backupSupported() ? 'none' : 'unsupported'), folder: DIRH ? DIRH.name : '', last: S.lastBackup || 0, lastDownload: S.lastDownload || 0,
    fileFound: !!window.SE_BACKUP, fileSavedAt: window.SE_BACKUP ? window.SE_BACKUP.savedAt || 0 : 0 };
}

/* ---------------------------------------------------------------- boot + exports */
function applyTheme() {
  var t = S.settings.theme || 'light';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  document.documentElement.classList.toggle('fr-off', !frOn());
}
function setFileHandle(h) { FILEH = h; if (h) idbPut('fileHandle', h); }
function boot() {
  var hadLS = false; try { hadLS = !!localStorage.getItem(KEY); } catch (e) {}
  load(); buildIndex();
  /* the backup file in site/progress wins if it is newer than what the browser has (e.g. after clearing the cache) */
  var BK = window.SE_BACKUP;
  if (BK && BK.xp != null && (BK.savedAt || 0) > ((hadLS && S.savedAt) || 0) + 1000) {
    try { S = JSON.parse(JSON.stringify(BK)); fill(); localStorage.setItem(KEY, JSON.stringify(S)); hadLS = true; setTimeout(function () { toast('Progress restored from your backup file'); }, 600); } catch (e) {}
  }
  applyTheme();
  emit('boot');
  window.addEventListener('hashchange', dispatch);
  if (!hadLS) {
    RESTORING = true;
    var started = false, startNow = function () { if (started) return; started = true; RESTORING = false; dispatch(); };
    setTimeout(startNow, 1500);
    idbGet('state', function (json) {
      if (json && !started) { try { S = JSON.parse(json); fill(); localStorage.setItem(KEY, json); applyTheme(); if (S.xp) toast('Progress restored'); } catch (e) {} }
      startNow();
    });
  } else { dispatch(); idbPut('state', JSON.stringify(S)); }
  idbGet('fileHandle', function (hnd) {
    if (!hnd || !hnd.queryPermission) return;
    hnd.queryPermission({ mode: 'readwrite' }).then(function (p) { if (p === 'granted') FILEH = hnd; }).catch(function () {});
  });
  idbGet('dirHandle', function (hnd) {
    if (!hnd || !hnd.queryPermission) return;
    DIRH = hnd;
    hnd.queryPermission({ mode: 'readwrite' }).then(function (p) { DIRSTATE = p === 'granted' ? 'ok' : 'needs-permission'; if (p === 'granted') writeBackupFolder(JSON.stringify(S)); emit('backup'); }).catch(function () {});
  });
}
function resetState() { S = blank(); save(); applyTheme(); dispatch(); }
function importState(json) { JSON.parse(json); localStorage.setItem(KEY, json); load(); applyTheme(); dispatch(); }

window.SE = {
  /* data */
  state: function () { return S; }, save: save, KEY: KEY, C: C,
  index: function () { return { LESSONS: LESSONS, ORDER: ORDER, ITEMS: ITEMS, WORDS: WORDS, WORDMAP: WORDMAP, COURSE_ORDER: COURSE_ORDER, GRADED: GRADED }; },
  LESSONS: LESSONS, ORDER: ORDER, ITEMS: ITEMS, WORDS: WORDS, WORDMAP: WORDMAP, COURSE_ORDER: COURSE_ORDER, GRADED: GRADED,
  courseVisible: courseVisible, lidVisible: lidVisible, visibleCourses: visibleCourses,
  resetState: resetState, importState: importState, setFileHandle: setFileHandle, applyTheme: applyTheme,
  backupStatus: backupStatus, connectBackupFolder: connectBackupFolder, resumeBackupFolder: resumeBackupFolder, downloadBackup: downloadBackup, loadBackupText: loadBackupText, backupSupported: backupSupported,
  /* utils */
  $: $, $$: $$, esc: esc, fmt: fmt, plain: plain, hasChain: hasChain, shuffle: shuffle, dstr: dstr, addDays: addDays, words: words, toast: toast, pick: pick, el: el,
  /* images, audio, french, glossary */
  imgRec: imgRec, illusCls: illusCls, imgHTML: imgHTML, speak: speak, stopSpeech: stopSpeech, sayBtn: sayBtn, frBtn: frBtn, trSpan: trSpan, frOn: frOn, setFrench: setFrench, frLine: frLine,
  applyGloss: applyGloss, showTip: showTip, hideTip: hideTip,
  /* writing + speaking + diagrams */
  trapCheck: trapCheck, feedbackBlock: feedbackBlock, sentenceRow: sentenceRow, readAloud: readAloud, stopRec: stopRec, diag: function (n) { return DIAG(n); },
  /* points */
  RANKS: RANKS, PTS: PTS, goal: goal, rankOf: rankOf, rankIndex: rankIndex, nextRank: nextRank, addXP: addXP, streakNow: streakNow, dayLog: dayLog, minutesOn: minutesOn, daysPracticed: daysPracticed,
  session: function (v) { if (v !== undefined) SESSION_XP = v; return SESSION_XP; },
  /* review + cards */
  recordItem: recordItem, itemPriority: itemPriority, dueItems: dueItems, troubleItems: troubleItems,
  cardData: cardData, cardState: cardState, rateCard: rateCard, cardPreview: cardPreview, mastery: mastery, dueCards: dueCards, saveCard: saveCard,
  /* lessons */
  isDone: isDone, isKnew: isKnew, levelDone: levelDone, pct: pct, lessonState: lessonState, levelPct: levelPct, levelKnewPct: levelKnewPct, starsHTML: starsHTML, currentLesson: currentLesson,
  lessonTestItems: lessonTestItems, levelTestItems: levelTestItems, markKnew: markKnew, finishLessonState: finishLessonState,
  skills: skills, stickers: stickers, planList: planList, planNext: planNext,
  /* questions */
  itemsPage: itemsPage, itemCard: itemCard, PRAISE: PRAISE,
  ui: ui,
  /* events + routing */
  on: on, emit: emit, route: route, go: go, bindGo: bindGo, dispatch: dispatch, ROUTES: ROUTES
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
