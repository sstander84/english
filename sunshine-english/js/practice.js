/* =========================================================
   Sunshine English: Practice (#/practice/<tab>)
   Tabs: review (Anki-style cards) · gap (fill the gap) · trouble · chat · sound · words · tests
   Uses window.SE from js/core.js. Styles: css/practice.css
   ========================================================= */
(function () {
'use strict';
var SE = window.SE;
if (!SE) return;
var $ = SE.$, $$ = SE.$$, esc = SE.esc, fmt = SE.fmt, plain = SE.plain, shuffle = SE.shuffle;
function S() { return SE.state(); }
function IX() { return SE.index(); }
function L(lid) { return IX().LESSONS[lid]; }
function frl(fr, cls) { return SE.frLine(fr, cls); }
function nrm(w) { return String(w || '').toLowerCase().replace(/[’‘]/g, "'"); }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function uniq(a) { var o = [], seen = {}; a.forEach(function (x) { var k = nrm(x); if (!seen[k]) { seen[k] = 1; o.push(x); } }); return o; }
function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }
function el(h) { return SE.el(h); }

/* ---------------------------------------------------------------- keyboard (one handler for the active tab) */
var KEYS = null;
document.addEventListener('keydown', function (e) {
  if (!KEYS || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  KEYS(e);
});
SE.on('route', function () { KEYS = null; });

/* ---------------------------------------------------------------- shared lookups */
function startedLids() {
  var st = S(), out = [];
  Object.keys(IX().LESSONS).forEach(function (lid) { if (SE.lidVisible(lid) && (SE.isDone(lid) || (st.prog || {})[lid])) out.push(lid); });
  return out;
}
/* lessons to draw from: the ones she started; if too few, the next ones in her plan */
function scopeLids(min) {
  var lids = startedLids();
  if (lids.length < (min || 2)) {
    var pl = SE.planList(), nx = SE.planNext(), i = Math.max(0, pl.indexOf(nx));
    for (var k = i; k < pl.length && lids.length < (min || 2) + 1; k++) if (lids.indexOf(pl[k]) < 0) lids.push(pl[k]);
  }
  return lids;
}
function sourceLabel(lid) {
  var x = L(lid); if (!x) return '';
  var c = x.course.id;
  if (c === 'path') return 'L' + (x.li + 1) + ' · Lesson ' + (x.i + 1);
  if (c === 'school') return 'Grade ' + (x.li + 1) + ' · Unit ' + (x.i + 1);
  return (x.level.title || x.course.title) + ' · ' + (x.i + 1);
}
function levelShort(x) {
  var c = x.course.id;
  if (c === 'path') return 'L' + (x.li + 1) + ' · ' + x.level.title;
  if (c === 'school') return 'Grade ' + (x.li + 1);
  return x.level.title;
}
function lessonImg(lid) { var x = L(lid); return x ? x.lesson.img : null; }

/* ---------------------------------------------------------------- page shell + sub-tabs */
var TABS = [['gap', 'Fill the gap'], ['gym', 'Conventions gym'], ['review', 'Review cards'], ['trouble', 'Trouble spots'], ['chat', 'Chat practice'], ['sound', 'Sound gym'], ['words', 'Words & phrases'], ['tests', 'Test-out center']];
function allEntries() {
  var out = [];
  IX().WORDS.forEach(function (o) { if (SE.lidVisible(o.lid)) out.push({ cid: 'w:' + o.id, en: o.w.w, fr: o.w.fr, note: o.w.def, ex: o.w.ex, lid: o.lid, kind: 'word', pos: o.w.pos, img: o.w.img }); });
  (ENG.phrases || []).forEach(function (p, i) { out.push({ cid: 'p:' + i, en: p.en, fr: p.fr, note: p.note, reply: p.reply, cat: p.cat, kind: 'phrase', img: p.img }); });
  return out;
}
function counts() {
  return { review: SE.dueCards(999).length, trouble: SE.troubleItems().length, words: allEntries().length };
}
function capN(n) { return n > 99 ? '99+' : n; }
function subtabs(tab) {
  var c = counts();
  var lab = { review: c.review ? ' · ' + capN(c.review) : '', trouble: c.trouble ? ' · ' + capN(c.trouble) : '', words: ' · ' + c.words };
  return '<div class="pr-tabs"><div class="pr-tabs-in">' + TABS.map(function (t) {
    return '<a class="pr-tab' + (t[0] === tab ? ' on' : '') + '" href="#/practice/' + t[0] + '" data-go="#/practice/' + t[0] + '">' + t[1] + (lab[t[0]] || '') + '</a>';
  }).join('') + '</div></div>';
}
function view(main, args) {
  var tab = args[0] || 'gap';
  if (!VIEWS[tab]) tab = 'gap';
  S().cloze = S().cloze || {};
  main.innerHTML = '<div class="pr">' + subtabs(tab) + '<div class="page pr-body" id="prBody"></div></div>';
  SE.bindGo(main);
  VIEWS[tab]($('#prBody', main), args.slice(1));
  SE.bindGo(main);
}
SE.route('practice', view);
if (!SE.ROUTES.words) SE.route('words', function (main) { SE.go('#/practice/words'); });
if (!SE.ROUTES.phrases) SE.route('phrases', function (main) { SE.go('#/practice/words'); });

var VIEWS = {};

/* ================================================================ 1. REVIEW CARDS (Anki style) */
var RATES = [['Again', 'again'], ['Hard', 'hard'], ['Good', 'good'], ['Easy', 'easy']];
function cardView(cid) {
  var d = SE.cardData(cid); if (!d) return null;
  var v = { cid: cid, term: d.term, fr: d.fr, mean: d.def, img: d.img || (d.lid ? lessonImg(d.lid) : null), from: '', ctx: '', ex: '' };
  if (d.kind === 'word') {
    var x = L(d.lid);
    v.from = 'From · ' + (x ? x.lesson.title : 'your lessons');
    v.ctx = d.ex ? '“' + plain(d.ex) + '”' : '';
  } else {
    var p = ENG.phrases[+cid.slice(2)] || {};
    v.from = 'From · Phrasebook · ' + (p.cat || '');
    v.ctx = p.reply ? 'They answer: “' + plain(p.reply) + '”' : '';
    v.mean = p.note || d.def;
  }
  return v;
}
function newCardsFallback(n) {
  var lid = SE.planNext() || SE.planList()[0], out = [];
  var lids = lid ? [lid] : [];
  var pl = SE.planList(), i = pl.indexOf(lid);
  while (lids.length < 4 && i >= 0 && i + 1 < pl.length) { i++; lids.push(pl[i]); }
  IX().WORDS.forEach(function (o) { if (lids.indexOf(o.lid) >= 0 && !(S().cards || {})['w:' + o.id] && out.length < n) out.push('w:' + o.id); });
  if (!out.length) (ENG.phrases || []).forEach(function (p, k) { if (out.length < n && !(S().cards || {})['p:' + k]) out.push('p:' + k); });
  return { ids: out, lid: lid };
}
var RV = null;
VIEWS.review = function (body) {
  var due = SE.dueCards(20), note = '';
  if (!due.length) { var fb = newCardsFallback(12); due = fb.ids; if (fb.lid && L(fb.lid)) note = 'Nothing is due. Here are new words from “' + L(fb.lid).lesson.title + '”.'; else note = 'Nothing is due. Here are some new cards.'; }
  RV = { queue: due.slice(), total: due.length, i: 0, flipped: false, again: {}, reviewed: 0, gotAgain: 0 };
  body.innerHTML = '<div class="pr-grid"><div id="rvMain"></div><div class="pr-side" id="rvSide"></div></div>';
  drawSide($('#rvSide', body));
  if (note) RV.note = note;
  drawCard();
};
function drawCard() {
  var box = $('#rvMain'); if (!box) return;
  if (!RV.queue.length) return drawReviewDone(box);
  var cid = RV.queue[0], v = cardView(cid);
  if (!v) { RV.queue.shift(); return drawCard(); }
  var n = Math.min(RV.reviewed + 1, RV.total), left = Math.max(1, Math.round(RV.queue.length * 0.35));
  var im = SE.imgRec(v.img);
  var prev = SE.cardPreview(cid);
  var h = '<div class="rv-head"><div style="flex:1"><div class="eyebrow">Review · Card ' + n + ' of ' + RV.total + '</div><h1 class="rv-h1">Keep it fresh.</h1></div><span class="rv-meta">about ' + left + ' min left · +' + SE.PTS.review + ' pts</span></div>' +
    '<div class="rv-bar"><i style="width:' + Math.round(RV.reviewed / Math.max(1, RV.total) * 100) + '%"></i></div>' +
    (RV.note ? '<div class="rv-note">' + esc(RV.note) + '</div>' : '') +
    '<div class="rv-card' + (RV.flipped ? ' flipped' : '') + '" id="rvCard" tabindex="0" role="button" aria-label="Flip the card">' +
      '<div class="rv-photo">' + (im ? '<img alt="" src="' + esc(im.u) + '">' : '<span>' + esc(String(v.img || 'card').replace(/^[a-z]\d?_/, '').replace(/_/g, ' ')) + '</span>') + '</div>' +
      '<div class="rv-content"><div class="eyebrow rose">' + esc(v.from) + '</div><div class="rv-term">' + esc(plain(v.term)) + '</div>' +
      (v.ctx ? '<div class="rv-ctx">' + esc(v.ctx) + '</div>' : '') +
      (RV.flipped ? '<div class="rv-back"><div class="rv-mean">' + fmt(v.mean || '') + '</div>' +
        (v.fr ? '<div class="rv-fr fr-line"><span class="frtag rose">FR</span><span class="rv-frtext">' + esc(v.fr) + '</span></div>' : '') +
        (v.ex ? '<div class="rv-ex">Example: ' + esc(plain(v.ex)) + '</div>' : '') + '</div>'
        : '<div class="rv-hint">Say what it means out loud, then tap to check.</div>') +
      '</div></div>';
  if (RV.flipped) {
    h += '<div class="rv-rates">' + RATES.map(function (r, k) { return '<button class="rv-rate ' + r[1] + '" data-g="' + k + '"><b>' + r[0] + '</b><span>in ' + prev[k] + '</span><kbd>' + (k + 1) + '</kbd></button>'; }).join('') + '</div>';
  } else {
    h += '<div class="rv-actions"><button class="btn primary lg" id="rvShow">Show answer</button><button class="btn lg" id="rvListen">▶ Listen</button></div>';
  }
  box.innerHTML = h;
  var flip = function () { if (!RV.flipped) { RV.flipped = true; drawCard(); } };
  $('#rvCard', box).onclick = flip;
  if (!RV.flipped) { $('#rvShow', box).onclick = flip; $('#rvListen', box).onclick = function () { SE.speak(plain(v.term)); }; }
  $$('[data-g]', box).forEach(function (b) { b.onclick = function () { rate(+b.getAttribute('data-g')); }; });
  KEYS = function (e) {
    if (!RV.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); return; }
    if (RV.flipped && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(+e.key - 1); }
    if (RV.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); rate(2); }
  };
}
function rate(g) {
  var cid = RV.queue.shift();
  SE.rateCard(cid, g);
  RV.reviewed++; RV.flipped = false; RV.note = '';
  if (g === 0) { RV.gotAgain++; RV.again[cid] = (RV.again[cid] || 0) + 1; if (RV.again[cid] <= 2) { RV.queue.push(cid); RV.total++; } }
  drawCard();
}
function drawReviewDone(box) {
  var unique = RV.reviewed - Object.keys(RV.again).reduce(function (a, k) { return a + Math.min(2, RV.again[k]); }, 0);
  if (RV.reviewed >= 3 && !RV.paid) { RV.paid = true; SE.addXP(SE.PTS.review); }
  box.innerHTML = '<div class="eyebrow">Review · done</div><h1 class="rv-h1">' + (RV.reviewed ? 'All fresh. <em>Nice.</em>' : 'Nothing to review yet.') + '</h1>' +
    '<p class="lead" style="margin-top:12px">' + (RV.reviewed ? RV.reviewed + ' cards reviewed' + (RV.gotAgain ? ', ' + RV.gotAgain + ' came back a second time.' : '.') + (RV.paid ? ' +' + SE.PTS.review + ' pts.' : '') : 'Start a lesson and its new words will show up here as cards.') + '</p>' +
    '<div class="rv-done-actions"><button class="btn primary" id="rvMore">Another round</button><button class="btn" data-go="#/practice/gap">Fill the gap</button><button class="btn" data-go="#/practice/words">Words &amp; phrases</button></div>';
  SE.bindGo(box);
  $('#rvMore', box).onclick = function () { SE.dispatch(); };
  KEYS = function (e) { if (e.key === 'Enter') { e.preventDefault(); SE.dispatch(); } };
}
/* right column: trouble spots + other modes */
function troubleRows(n) {
  return SE.troubleItems(n).map(function (id) { var x = IX().ITEMS[id]; return Object.assign({ id: id, miss: (S().items[id] || {}).wrong || 0, lid: x.lid }, wrongRight(x.item)); });
}
function wrongRight(it) {
  var a0 = plain(SE.C.arr(it.a)[0] != null ? SE.C.arr(it.a)[0] : '');
  if (it.k === 'fix') return { bad: plain(it.s), good: a0 };
  if (it.k === 'mcq' || it.k === 'pic') return { bad: plain(it.q || ''), good: plain(it.opts[it.a] || ''), q: true };
  if (it.k === 'order') return { bad: plain(it.q || 'Put the words in order'), good: plain(it.a), q: true };
  if (it.k === 'listen') return { bad: 'Listen & type', good: plain(it.say), q: true };
  var q = plain(it.q || '');
  if (/_{2,}/.test(q)) return { bad: q.replace(/_{2,}/, '___'), good: q.replace(/_{2,}/, a0).replace(/\s*\([^)]*\)\s*$/, ''), q: true };
  return { bad: q, good: a0, q: true };
}
function drawSide(box) {
  var rows = troubleRows(3);
  var h = '<div class="card pr-trouble"><div class="pr-trouble-h"><h3 class="h3s">Trouble spots</h3><a class="link small" data-go="#/practice/trouble">' + (rows.length ? 'Practice · 2 min' : 'See all') + '</a></div><div class="pr-traps">' +
    (rows.length ? rows.map(function (r) { return '<div class="trap' + (r.q ? ' q' : '') + '"><span class="' + (r.q ? 'qq' : 'bad') + '">' + esc(trunc(r.bad, 46)) + '</span><span class="arr">→</span><b>' + esc(trunc(r.good, 46)) + '</b></div>'; }).join('')
      : '<div class="trap empty">No trouble spots yet. Questions you miss land here.</div>') + '</div></div>';
  var modes = [
    ['#/practice/gap', 'Fill the gap', 'A sentence, a blank, a few words. Pick the one that fits.', '4 min', 'butter', '___'],
    ['#/practice/chat', 'Chat practice', 'Role-play real scenes: finish your lines in the chat.', '5 min', 'img', ''],
    ['#/practice/sound', 'Sound gym', 'th, h, and ship vs. sheep. Optional, short.', '3 min', 'butter', 'th'],
    ['#/practice/tests', 'Test-out center', 'Skip any lesson or level you already know.', '5–15 min', 'rose', '✓']
  ];
  var chatImg = SE.imgRec('checkout') || SE.imgRec('barista');
  h += modes.map(function (m) {
    var tile = m[4] === 'img' && chatImg ? '<div class="mode-tile img"><img alt="" src="' + esc(chatImg.u) + '"></div>' : '<div class="mode-tile ' + m[4] + '">' + esc(m[5]) + '</div>';
    return '<button class="card mode" data-go="' + m[0] + '">' + tile + '<div class="mode-t"><b>' + m[1] + '</b><span>' + m[2] + '</span></div><span class="mode-m">' + m[3] + '</span></button>';
  }).join('');
  box.innerHTML = h; SE.bindGo(box);
}
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ================================================================ grammar blanks (shared by Fill the gap + Chat) */
var C = SE.C;
var PAST = {}; Object.keys(C.IRR).forEach(function (p) { var b = C.IRR[p]; if (b !== 'be' && !PAST[b] && !/n$/.test(p)) PAST[b] = p; });
var PART = { go: 'gone', see: 'seen', eat: 'eaten', take: 'taken', write: 'written', speak: 'spoken', do: 'done', be: 'been', give: 'given', forget: 'forgotten', drive: 'driven', wake: 'woken', wear: 'worn', swim: 'swum', drink: 'drunk', begin: 'begun', run: 'run', come: 'come', know: 'known' };
function cvc(b) { return b.length <= 4 && /[^aeiou][aeiou][bdgmnprt]$/.test(b) && !/^(open|visit|happen|listen|answer|enter)$/.test(b); }
function third(b) { if (b === 'have') return 'has'; if (b === 'do') return 'does'; if (b === 'go') return 'goes'; if (/(s|sh|ch|x|o|z)$/.test(b)) return b + 'es'; if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + 'ies'; return b + 's'; }
function past(b) { if (PAST[b]) return PAST[b]; if (/e$/.test(b)) return b + 'd'; if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + 'ied'; if (cvc(b)) return b + b.slice(-1) + 'ed'; return b + 'ed'; }
function ing(b) { if (b === 'see' || /ee$/.test(b)) return b + 'ing'; if (/ie$/.test(b)) return b.slice(0, -2) + 'ying'; if (/e$/.test(b)) return b.slice(0, -1) + 'ing'; if (cvc(b)) return b + b.slice(-1) + 'ing'; return b + 'ing'; }
function part(b) { return PART[b] || past(b); }
function baseOf(w) {
  if (C.BASESET[w]) return w;
  if (C.IRR[w] && C.IRR[w] !== 'be') return C.IRR[w];
  var t = C.thirdToBase(w); if (t) return t;
  var cands = [];
  if (/ing$/.test(w)) { var s = w.slice(0, -3); cands.push(s, s + 'e', s.slice(0, -1)); if (/y$/.test(s)) cands.push(s.slice(0, -1) + 'ie'); }
  if (/ed$/.test(w)) { var r = w.slice(0, -2); cands.push(r, w.slice(0, -1), r.slice(0, -1)); if (/i$/.test(r)) cands.push(r.slice(0, -1) + 'y'); }
  for (var i = 0; i < cands.length; i++) if (C.BASESET[cands[i]]) return cands[i];
  return null;
}
var SUBJ3 = { he: 1, she: 1, it: 1 }, SUBJ_OTHER = { i: 1, you: 1, we: 1, they: 1 };
var AUX_BASE = { do: 1, does: 1, did: 1, "don't": 1, "doesn't": 1, "didn't": 1, can: 1, "can't": 1, could: 1, "couldn't": 1, will: 1, "won't": 1, would: 1, "wouldn't": 1, should: 1, "shouldn't": 1, must: 1, might: 1, to: 1, "let's": 1, "i'll": 1, "you'll": 1, "we'll": 1, "they'll": 1, "she'll": 1, "he'll": 1, "i'd": 1, "you'd": 1 };
var BE = { am: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, "i'm": 1, "you're": 1, "we're": 1, "they're": 1, "she's": 1, "he's": 1, "it's": 1, "isn't": 1, "aren't": 1, "wasn't": 1, "weren't": 1 };
var HAVE = { have: 1, has: 1, had: 1, "i've": 1, "you've": 1, "we've": 1, "they've": 1, "haven't": 1, "hasn't": 1 };
var ADV = { usually: 1, always: 1, never: 1, often: 1, sometimes: 1, really: 1, just: 1, also: 1, already: 1, still: 1, actually: 1, even: 1, not: 1, rarely: 1, finally: 1 };
var PASTMARK = /\b(yesterday|last (week|night|year|month|summer|weekend|time|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|ago|this morning|in (19|20)\d\d|when i was)\b/i;
var DAYS = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|weekends?|christmas|thanksgiving|my birthday)$/;
var MONTHS = /^(january|february|march|april|may|june|july|august|september|october|november|december|summer|winter|spring|fall|\d{4})$/;
var EXPL = {
  verb: ['Which form? Look at the words around it. After do/does/did, can, will or “to”, use the simple form (go). With he/she/it every day: goes. A finished past time: went. After am/is/are: going.', 'Quelle forme ? Regarde les mots autour. Après do/does/did, can, will ou « to » : la forme simple (go). Avec he/she/it au présent : goes. Passé terminé : went. Après am/is/are : going.'],
  be: ['I am · he/she/it is · you/we/they are. In the past: I/he/she/it was · you/we/they were.', 'I am · he/she/it is · you/we/they are. Au passé : was (I, he, she, it) et were (you, we, they).'],
  do: ['Questions and “not” use do. With he/she/it it becomes does, and the next verb stays simple: Does she work?', 'Les questions et la négation utilisent do. Avec he/she/it : does, et le verbe suivant reste simple : Does she work?'],
  have: ['I/you/we/they have · he/she/it has.', 'I/you/we/they have · he/she/it has.'],
  article: ['“an” before a vowel SOUND (an hour, an apple), “a” before a consonant sound (a car, a uniform).', '« an » devant un son de voyelle (an hour), « a » devant un son de consonne (a car, a uniform).'],
  much: ['many + things you can count (many friends) · much + things you can’t count (much time, much money).', 'many + ce qui se compte (many friends) · much + ce qui ne se compte pas (much time).'],
  this: ['this + one thing · these + more than one.', 'this + un seul · these + plusieurs.'],
  prep: ['Time: in + months, years, seasons and parts of the day (in July, in the morning) · on + days and dates (on Monday) · at + clock times and night (at 7, at night).', 'Le temps : in + mois, années, saisons, moments de la journée (in July, in the morning) · on + jours et dates (on Monday) · at + heures et la nuit (at 7, at night).'],
  forsince: ['for + an amount of time (for two years) · since + the starting point (since 2024, since Monday). Both mean “depuis”.', 'for + une durée (for two years) · since + le point de départ (since 2024). Les deux = « depuis ».']
};
function tokenize(s) { return s.split(/([A-Za-zÀ-ÿ’']+)/); }
/* find an unambiguous grammar blank in a sentence: {pos (index in parts), answer, choices, set} */
function grammarBlank(sentence) {
  var parts = tokenize(sentence), idx = [];
  for (var i = 1; i < parts.length; i += 2) idx.push(i);
  var low = parts.map(nrm);
  function prevWord(p, skipAdv) { for (var j = p - 2; j >= 1; j -= 2) { if (skipAdv && ADV[low[j]]) continue; return low[j]; } return ''; }
  function nextWord(p) { return p + 2 < parts.length ? low[p + 2] : ''; }
  var cand = [];
  idx.forEach(function (p) {
    var w = low[p], pw = prevWord(p, true), nw = nextWord(p), r = null;
    var tight = p + 1 < parts.length && /^\s+$/.test(parts[p + 1]); /* next word follows directly (no punctuation) */
    if (/^(a|an|much|many|this|these|in|on|at|for|since)$/.test(w) && !tight) return;
    if ((w === 'a' || w === 'an') && nw && /^[a-z]/.test(nw) && !/^(lot|few|little|bit|while)$/.test(nw)) r = { answer: parts[p], choices: ['a', 'an'], set: 'article' };
    else if (/^(am|is|are)$/.test(w) && (SUBJ3[pw] || SUBJ_OTHER[pw] || SUBJ3[nw] || SUBJ_OTHER[nw])) r = { answer: parts[p], choices: ['am', 'is', 'are', 'be', 'being'], set: 'be' };
    else if (/^(was|were)$/.test(w) && (SUBJ3[pw] || SUBJ_OTHER[pw] || SUBJ3[nw] || SUBJ_OTHER[nw])) r = { answer: parts[p], choices: ['was', 'were', 'be', 'been', 'being'], set: 'be' };
    else if (/^(do|does)$/.test(w) && (SUBJ3[nw] || SUBJ_OTHER[nw] || ((SUBJ3[pw] || SUBJ_OTHER[pw]) && nw === "n't"))) r = { answer: parts[p], choices: ['do', 'does', 'doing', 'done'], set: 'do' };
    else if (/^(have|has)$/.test(w) && (SUBJ3[pw] || SUBJ_OTHER[pw])) r = { answer: parts[p], choices: ['have', 'has', 'having', 'is'], set: 'have' };
    else if (/^(much|many)$/.test(w) && nw && !/^(more|of|as|too)$/.test(nw) && pw !== 'too' && pw !== 'so' && pw !== 'thanks' && pw !== 'very') r = { answer: parts[p], choices: ['much', 'many'], set: 'much' };
    else if (/^(this|these)$/.test(w) && nw && !/^(is|are|was|were|one|ones|time)$/.test(nw) && /^[a-z]{3,}$/.test(nw)) r = { answer: parts[p], choices: ['this', 'these'], set: 'this' };
    else if (/^(in|on|at)$/.test(w) && nw && (DAYS.test(nw) || MONTHS.test(nw) || /^\d{1,2}(:\d\d)?$/.test(nw) || nw === 'night' || nw === 'noon' || nw === 'midnight' || (nw === 'the' && /^(morning|afternoon|evening)$/.test(low[p + 4] || '')))) r = { answer: parts[p], choices: ['in', 'on', 'at'], set: 'prep' };
    else if (/^(for|since)$/.test(w) && nw && (/^(\d+|two|three|four|five|six|seven|eight|nine|ten|a|several|many)$/.test(nw) && /^(years?|months?|weeks?|days?|hours?|minutes?|while|long)$/.test(low[p + 4] || '') || (w === 'since' && (MONTHS.test(nw) || DAYS.test(nw) || /^(\d{4}|i|she|he|we|they|last|yesterday)$/.test(nw))))) r = { answer: parts[p], choices: ['for', 'since', 'ago'], set: 'forsince' };
    else if (/^[a-z]+$/.test(w) && w.length > 1) {
      var b = baseOf(w);
      if (b && b !== 'be') {
        var F = { base: b, third: third(b), past: past(b), ing: ing(b), part: part(b) };
        if (AUX_BASE[pw] && w === F.base) r = { answer: parts[p], choices: [F.base, F.third, F.ing, pw === 'to' ? F.past : 'to ' + F.base, F.past], set: 'verb' };
        else if (BE[pw] && w === F.ing) r = { answer: parts[p], choices: [F.ing, F.base, F.past, F.third], set: 'verb' };
        else if (HAVE[pw] && w === F.part && F.part !== F.base) r = { answer: parts[p], choices: [F.part, F.base, F.ing, F.third].concat(F.past !== F.part ? [F.past] : []), set: 'verb' };
        else if (SUBJ3[pw] && w === F.third && F.third !== F.base) r = { answer: parts[p], choices: [F.third, F.base, F.ing, 'is ' + F.base], set: 'verb' };
        else if (SUBJ_OTHER[pw] && w === F.base && !PASTMARK.test(sentence)) r = { answer: parts[p], choices: [F.base, F.third, F.ing, 'to ' + F.base], set: 'verb' };
        else if ((SUBJ3[pw] || SUBJ_OTHER[pw]) && w === F.past && F.past !== F.base && PASTMARK.test(sentence)) r = { answer: parts[p], choices: [F.past, F.base, F.ing, F.third], set: 'verb' };
      }
    }
    if (r) {
      r.choices = uniq(r.choices); if (r.choices.length < 2) return;
      if (!r.choices.some(function (c) { return nrm(c) === nrm(r.answer); })) return;
      r.pos = p; r.weight = r.set === 'verb' ? 3 : r.set === 'article' ? 1 : 2; cand.push(r);
    }
  });
  if (!cand.length) return null;
  cand.sort(function (a, b) { return b.weight - a.weight + (Math.random() - 0.5); });
  var c = cand[0];
  return { parts: parts, pos: c.pos, answer: c.answer, choices: matchCase(c.choices, c.answer), set: c.set };
}
function matchCase(list, ans) { var up = /^[A-Z]/.test(ans); return list.map(function (x) { return up ? x.charAt(0).toUpperCase() + x.slice(1) : x; }); }

var STOP = {}; ('the a an and or but so to of in on at for with from by about as into than then that this these those it its is are was were be been am do does did have has had will would can could should must might may i you he she we they me him her us them my your his our their what which who when where why how not no yes just very really too also there here up out if all some any more most much many one two get got go going like know think want need make let okay oh hey well yeah sure thanks thank please sorry').split(' ').forEach(function (w) { STOP[w] = 1; });
/* content-word blank (vocabulary) with distractors from a pool of words */
function wordBlank(sentence, pool) {
  var parts = tokenize(sentence), best = null;
  for (var i = 1; i < parts.length; i += 2) {
    var w = nrm(parts[i]);
    if (w.length < 4 || STOP[w] || /'/.test(w)) continue;
    if (i > 1 && /^[A-Z]/.test(parts[i])) continue; /* names */
    if (!best || w.length > nrm(parts[best]).length) best = i;
  }
  if (!best) return null;
  var ans = parts[best], al = nrm(ans).length;
  var ds = shuffle(pool.filter(function (x) { var xl = nrm(x); return xl !== nrm(ans) && Math.abs(xl.length - al) <= 3 && sentence.toLowerCase().indexOf(xl) < 0; })).slice(0, 2);
  if (ds.length < 2) return null;
  return { parts: parts, pos: best, answer: ans, choices: matchCase([nrm(ans)].concat(ds.map(nrm)), ans), set: 'word' };
}

/* ================================================================ 2. FILL THE GAP (cloze) */
var GP = null, GFILTER = { kind: 'all', lid: '' };
function headOf(w) { return String(w || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/^to\s+/i, '').replace(/^(a|an|the)\s+/i, '').replace(/[.!?…]+$/, '').trim(); }
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]"); }
/* build a word cloze from a lesson word's example */
function wordCloze(o, byLevel) {
  var w = o.w, ex = plain(w.ex || ''); if (!ex || ex.split(/\s+/).length < 3) return null;
  var head = headOf(w.w); if (!head || head.split(/\s+/).length > 4) return null;
  var hw = head.split(/\s+/);
  var re = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + hw.map(function (x, i) { return i === 0 ? escRe(x.length > 3 ? x.replace(/e$/, '') : x) + '[a-zà-ÿ]*' : escRe(x); }).join('\\s+') + ')(?![A-Za-zÀ-ÿ])', 'i');
  var m = re.exec(ex); if (!m) return null;
  var ans = m[2], start = m.index + m[1].length;
  var suffix = nrm(ans).indexOf(nrm(head)) === 0 ? ans.slice(head.length) : '';
  var verb = /verb/i.test(w.pos || '');
  var pool = (byLevel[o._lv] || []).filter(function (x) { return x !== o && headOf(x.w.w) && nrm(headOf(x.w.w)) !== nrm(head) && ((x.w.pos || '').split(' ')[0] === (w.pos || '').split(' ')[0]); });
  if (pool.length < 2) pool = (byLevel._all || []).filter(function (x) { return x !== o && ((x.w.pos || '').split(' ')[0] === (w.pos || '').split(' ')[0]) && nrm(headOf(x.w.w)) !== nrm(head); });
  var ds = [];
  shuffle(pool).some(function (x) {
    var h2 = headOf(x.w.w); if (h2.split(/\s+/).length > 3 || /[\/(),;]/.test(h2)) return false;
    var form = suffix && verb ? (/^ed$|^d$/.test(suffix) ? h2.replace(/e$/, '') + 'ed' : /^ing$/.test(suffix) ? h2.replace(/e$/, '') + 'ing' : h2 + suffix) : h2;
    if (ex.toLowerCase().indexOf(form.toLowerCase()) >= 0 || ds.some(function (d) { return nrm(d) === nrm(form); }) || nrm(form) === nrm(ans)) return false;
    ds.push(form); return ds.length >= 4;
  });
  if (ds.length < 2) return null;
  return { key: 'w:' + o.id, kind: 'word', before: ex.slice(0, start), after: ex.slice(start + ans.length), answer: ans, choices: shuffle([ans].concat(ds)), lid: o.lid,
    expl: '<b>' + esc(w.w) + '</b>: ' + fmt(w.def || ''), exFr: w.fr ? w.w + ' = ' + w.fr : '' };
}
function partsToCloze(b, key, kind, lid, expl, exFr) {
  var before = b.parts.slice(0, b.pos).join(''), after = b.parts.slice(b.pos + 1).join('');
  return { key: key, kind: kind, before: before, after: after, answer: b.answer, choices: shuffle(b.choices), lid: lid, expl: expl, exFr: exFr };
}
function lessonSentences(lid) {
  var x = L(lid); if (!x) return [];
  var out = [];
  function add(s) { s = plain(s || '').replace(/\s+/g, ' ').trim(); var n = s.split(' ').length; if (n >= 4 && n <= 20 && !/_{2,}|\n/.test(s)) out.push(s); }
  x.lesson.steps.forEach(function (st) {
    if (st.type === 'dialogue') (st.lines || []).forEach(function (l) { add(l.t); });
    if (st.type === 'teach' || st.type === 'rule' || st.type === 'culture') (st.examples || []).forEach(add);
    if (st.type === 'learn') (st.cards || []).forEach(function (c) { add(String(c.en || '').split(' / ')[0]); add(c.ex); });
    if (st.type === 'speak') (st.sentences || []).forEach(add);
    if (st.type === 'convo') (st.turns || []).forEach(function (t) { if (t.t) add(t.t); (t.choices || []).forEach(function (c) { if (c.ok) add(c.t); }); });
  });
  return uniq(out);
}
/* curated gaps from the Conventions gym: multiple-choice questions with a ___ and short options */
function gymGaps() {
  var out = [], ITEMS = IX().ITEMS;
  Object.keys(ITEMS).forEach(function (id) {
    var x = ITEMS[id], L0 = L(x.lid); if (!L0 || L0.course.id !== 'gym') return;
    var it = x.item; if (it.k !== 'mcq' || !it.q || (it.q.match(/___/g) || []).length !== 1 || !it.opts || it.opts.length < 3) return;
    if (it.opts.some(function (o) { return plain(o).split(/\s+/).length > 5; })) return;
    var q = plain(it.q), at = q.indexOf('___'), lead = q.slice(0, at), m = lead.match(/^(.*?[:?.!])\s+(?=[A-Z“"])/);
    var before = m && m[1].length < at ? lead.slice(m[0].length) : lead, ctx = m && m[1].length < at ? m[1] : '';
    out.push({ key: 'cv:' + id, itemId: id, kind: 'gym', before: before, after: q.slice(at + 3), answer: plain(it.opts[it.a]), choices: shuffle(it.opts.map(plain)), lid: x.lid, ctx: ctx,
      expl: it.why ? fmt(it.why) : '', exFr: it.whyFr || '' });
  });
  return out;
}
function buildGapPool(lids) {
  var pool = [], byLevel = { _all: [] };
  IX().WORDS.forEach(function (o) { if (!SE.lidVisible(o.lid)) return; var x = L(o.lid); o._lv = x.level.id; (byLevel[o._lv] = byLevel[o._lv] || []).push(o); byLevel._all.push(o); });
  IX().WORDS.forEach(function (o) { if (lids.indexOf(o.lid) < 0) return; var c = wordCloze(o, byLevel); if (c) pool.push(c); });
  lids.forEach(function (lid) {
    lessonSentences(lid).forEach(function (s) {
      var b = grammarBlank(s); if (!b) return;
      var e = EXPL[b.set] || EXPL.verb;
      pool.push(partsToCloze(b, 'g:' + hash(s + '|' + b.pos), 'grammar', lid, esc(e[0]), e[1]));
    });
  });
  /* phrasebook: grammar blank first, else a key word */
  var phraseWords = []; (ENG.phrases || []).forEach(function (p) { tokenize(plain(p.en)).forEach(function (t, i) { if (i % 2 && t.length >= 4 && !STOP[nrm(t)]) phraseWords.push(t); }); });
  phraseWords = uniq(phraseWords);
  (ENG.phrases || []).forEach(function (p, i) {
    var s = plain(p.en); if (s.split(/\s+/).length < 3) return;
    var b = grammarBlank(s) || wordBlank(s, phraseWords); if (!b) return;
    var e = b.set !== 'word' ? (EXPL[b.set] || EXPL.verb) : null;
    pool.push(partsToCloze(b, 'p:' + i + ':' + b.pos, 'phrase', null, (e ? esc(e[0]) + '<br>' : '') + fmt(p.note || ''), p.fr ? '“' + p.fr + '”' : (e ? e[1] : '')));
  });
  return pool.concat(gymGaps());
}
function clozeStat(key) { var c = S().cloze; return c[key] || null; }
function pickGapSession(pool, n) {
  var now = Date.now();
  var scored = pool.map(function (c) {
    var st = clozeStat(c.key), s = Math.random() * 1.5;
    if (!st) s += 1.5; else { s += (st.w - st.r) * 3 + (st.due <= now ? 2 : -3) + (st.lastWrong && now - st.lastWrong < 3 * 86400000 ? 2 : 0); }
    return { c: c, s: s };
  }).sort(function (a, b) { return b.s - a.s; });
  /* keep a mix of kinds */
  var out = [], quota = { word: Math.ceil(n * 0.35), grammar: Math.ceil(n * 0.3), phrase: Math.ceil(n * 0.2), gym: Math.ceil(n * 0.35) };
  scored.forEach(function (x) { if (out.length < n && (quota[x.c.kind] || 0) > 0) { quota[x.c.kind]--; out.push(x.c); } });
  scored.forEach(function (x) { if (out.length < n && out.indexOf(x.c) < 0) out.push(x.c); });
  return shuffle(out);
}
function loveLids() { var lv = (ENG.courses.path && ENG.courses.path.levels || []).filter(function (l) { return l.id === 'LOVE'; })[0]; return lv ? lv.lessons.map(function (l) { return l.id; }).filter(function (id) { return SE.lidVisible(id); }) : []; }
VIEWS.gap = function (body) {
  var started = startedLids(), lids, love = loveLids(), loveSet = {};
  love.forEach(function (id) { loveSet[id] = 1; });
  if (GFILTER.lid && L(GFILTER.lid)) lids = [GFILTER.lid];
  else if (GFILTER.kind === 'love') lids = love;
  else { lids = scopeLids(3); love.forEach(function (id) { if (lids.indexOf(id) < 0) lids.push(id); }); }
  var pool = buildGapPool(lids);
  if (GFILTER.kind === 'love') {}
  else if (GFILTER.kind === 'trouble') { pool = pool.filter(function (c) { var st = clozeStat(c.key); return st && st.w > 0; }); }
  else if (GFILTER.kind !== 'all') pool = pool.filter(function (c) { return c.kind === GFILTER.kind; });
  var opts = startedLids().concat(SE.planList().slice(0, 30)).concat(love).filter(function (v, i, a) { return a.indexOf(v) === i; });
  var h = '<div class="gp-wrap"><div class="gp-head"><div style="flex:1"><div class="eyebrow">Fill the gap</div><h1 class="rv-h1">One word is <em>missing.</em></h1>' +
    '<p class="lead" style="margin-top:8px">Pick the word that fits. Missed ones come back sooner.</p>' + frl('Choisis le mot qui convient. Ceux que tu rates reviennent plus vite.') + '</div></div>' +
    '<div class="gp-filters">' + [['all', 'All'], ['word', 'Words'], ['grammar', 'Grammar'], ['gym', 'Conventions'], ['phrase', 'Phrases']].concat(love.length ? [['love', 'Love & relationships']] : []).concat([['trouble', 'My trouble words']]).map(function (f) { return '<button class="chip' + (GFILTER.kind === f[0] ? ' ink' : '') + '" data-k="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
    '<select class="field gp-sel" id="gpLid"><option value="">' + (started.length ? 'From my lessons' : 'From my next lessons') + '</option>' + opts.map(function (lid) { var x = L(lid); return '<option value="' + lid + '"' + (GFILTER.lid === lid ? ' selected' : '') + '>' + esc(sourceLabel(lid) + ' · ' + x.lesson.title) + '</option>'; }).join('') + '</select></div>' +
    '<div id="gpBox"></div></div>';
  body.innerHTML = h;
  $$('[data-k]', body).forEach(function (b) { b.onclick = function () { GFILTER.kind = b.getAttribute('data-k'); SE.dispatch(); }; });
  $('#gpLid', body).onchange = function () { GFILTER.lid = this.value; SE.dispatch(); };
  var list;
  if (!GFILTER.lid && GFILTER.kind === 'all' && love.length) {
    /* love & relationships is in the pool, but at most 4 of the 12 so it doesn't crowd out the rest */
    var pl = pool.filter(function (c) { return loveSet[c.lid]; }), po = pool.filter(function (c) { return !loveSet[c.lid]; });
    var kl = Math.min(4, pl.length, 12), ko = Math.min(12 - kl, po.length);
    list = shuffle(pickGapSession(po, ko).concat(pickGapSession(pl, Math.max(kl, 12 - ko))));
  } else list = pickGapSession(pool, 12);
  GP = { list: list, i: 0, right: 0, done: 0, missed: [], answered: null, retries: {} };
  drawGap();
};
function drawGap() {
  var box = $('#gpBox'); if (!box) return;
  if (!GP.list.length) { box.innerHTML = '<div class="card pad gp-empty"><h3 class="h3">Nothing here yet.</h3><p class="lead" style="margin-top:6px">' + (GFILTER.kind === 'trouble' ? 'No trouble words yet. Nice!' : 'Start a lesson first; its sentences and words become gap practice.') + '</p><div style="margin-top:14px"><button class="btn primary" data-go="#/journey">Open the journey</button></div></div>'; SE.bindGo(box); return; }
  if (GP.i >= GP.list.length) return drawGapDone(box);
  var c = GP.list[GP.i], a = GP.answered, total = GP.list.length;
  var blank = a ? '<span class="gp-blank ' + (a.ok ? 'ok' : 'no') + '">' + esc(a.ok ? c.answer : a.pick) + '</span>' : '<span class="gp-blank">&nbsp;</span>';
  var kindLabel = { word: 'Word', grammar: 'Grammar', phrase: 'Phrase', gym: 'Conventions' }[c.kind];
  var src = c.kind === 'gym' ? L(c.lid).lesson.title.replace(/[“”]/g, '') : c.lid ? sourceLabel(c.lid) : 'Phrasebook';
  var h = '<div class="gp-card card lg"><div class="gp-top"><span class="eyebrow rose">' + kindLabel + ' · ' + esc(src) + '</span><span class="eyebrow">' + (GP.i + 1) + ' of ' + total + '</span></div>' +
    '<div class="rv-bar thin"><i style="width:' + Math.round(GP.i / total * 100) + '%"></i></div>' +
    (c.ctx ? '<div class="gp-ctx">' + esc(c.ctx) + '</div>' : '') + '<div class="gp-sent">' + esc(c.before) + blank + esc(c.after) + '</div>' +
    '<div class="gp-opts">' + c.choices.map(function (w, k) {
      var cls = '';
      if (a) { if (nrm(w) === nrm(c.answer)) cls = a.ok || a.pick ? ' ok' : ''; if (!a.ok && nrm(w) === nrm(a.pick)) cls = ' no'; }
      return '<button class="gp-opt' + cls + '" data-w="' + esc(w) + '"' + (a ? ' disabled' : '') + '><kbd>' + (k + 1) + '</kbd>' + esc(w) + '</button>';
    }).join('') + '</div>';
  if (a) {
    if (a.ok) h += '<div class="gp-fb ok"><div class="gp-fb-t">' + rnd(['Exactly right!', 'Yes!', 'Perfect.', 'Nice one.']) + '</div>' + '<div class="gp-fb-b">' + (c.expl || '') + '</div>' + (c.exFr ? '<div class="fr-line nogloss">' + fmt(c.exFr) + '</div>' : '') + '</div>';
    else h += '<div class="gp-fb no"><div class="gp-fb-t">Not this time.</div>' + gapWalk(c, a.pick) +
      '<div class="gp-fb-n">This one comes back in a few cards.</div></div>';
  }
  h += '<div class="gp-foot"><button class="link-muted" id="gpSkip">Skip this one</button><span style="flex:1"></span>' +
    (a ? '<button class="btn primary" id="gpNext">' + (GP.i + 1 >= GP.list.length ? 'Finish' : 'Next') + ' →</button>' : '<button class="btn" id="gpListen">▶ Listen</button>') + '</div></div>';
  box.innerHTML = h;
  $$('.gp-opt', box).forEach(function (b) { b.onclick = function () { pickGap(b.getAttribute('data-w')); }; });
  $('#gpSkip', box).onclick = function () { GP.answered = null; GP.i++; drawGap(); };
  if ($('#gpNext', box)) $('#gpNext', box).onclick = nextGap;
  if ($('#gpListen', box)) $('#gpListen', box).onclick = function () { SE.speak(c.before + c.answer + c.after); };
  KEYS = function (e) {
    if (!GP.answered && /^[1-9]$/.test(e.key)) { var w = c.choices[+e.key - 1]; if (w) { e.preventDefault(); pickGap(w); } }
    else if (GP.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextGap(); }
  };
}
function htmlText(x) { var d = document.createElement('div'); d.innerHTML = String(x || '').replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<br\s*\/?>/g, ' '); return d.textContent.trim(); }
function gapWalk(c, pick) {
  var gi = c.itemId && IX().ITEMS[c.itemId] ? IX().ITEMS[c.itemId].item : null;
  var it = { k: 'mcq', q: c.before + '___' + c.after, why: gi && gi.why ? gi.why : htmlText(c.expl), whyFr: gi && gi.whyFr ? gi.whyFr : htmlText(c.exFr), walk: gi && gi.walk, walkFr: gi && gi.walkFr };
  if (window.SEPlayer && window.SEPlayer.walkthrough) return window.SEPlayer.walkthrough(it, pick, c.answer);
  return '<div class="walk"><div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s">' + esc(c.before) + '<ins>' + esc(c.answer) + '</ins>' + esc(c.after) + '</span></div></div>';
}
function pickGap(w) {
  if (GP.answered) return;
  var c = GP.list[GP.i], ok = nrm(w) === nrm(c.answer), st = S().cloze[c.key] || { r: 0, w: 0, due: 0 };
  var first = !GP.retries[c.key];
  if (ok) { st.r++; st.due = Date.now() + [0, 1, 3, 7, 14, 30][Math.min(5, st.r)] * 86400000; if (first) { GP.right++; SE.addXP(SE.PTS.item.cloze || 2); } }
  else { st.w++; st.due = Date.now(); st.lastWrong = Date.now(); if (!GP.retries[c.key]) { GP.retries[c.key] = 1; GP.missed.push(c); GP.list.splice(Math.min(GP.list.length, GP.i + 4), 0, Object.assign({}, c, { choices: shuffle(c.choices.slice()) })); } }
  S().cloze[c.key] = st; if (c.itemId) SE.recordItem(c.itemId, ok && first); SE.save();
  GP.answered = { ok: ok, pick: w };
  drawGap();
  /* no auto-advance: she presses Next when she's ready (Sam, Oct 28) */
}
function nextGap() { clearTimeout(GP.t); GP.answered = null; GP.i++; GP.done++; drawGap(); }
function drawGapDone(box) {
  var firstTotal = GP.list.length - GP.missed.length;
  box.innerHTML = '<div class="gp-card card lg"><div class="eyebrow">Fill the gap · done</div><h2 class="h2" style="margin-top:8px">' + GP.right + ' of ' + firstTotal + ' right <em>first time.</em></h2>' +
    (GP.missed.length ? '<p class="lead" style="margin-top:10px">These will come back sooner:</p><div class="gp-missed">' + GP.missed.map(function (c) { return '<div class="trap"><span>' + esc(c.before) + '<b>' + esc(c.answer) + '</b>' + esc(c.after) + '</span></div>'; }).join('') + '</div>' : '<p class="lead" style="margin-top:10px">Clean sweep. Nice.</p>') +
    '<div class="rv-done-actions"><button class="btn primary" id="gpMore">Another 12</button><button class="btn" data-go="#/practice/review">Review cards</button><button class="btn" data-go="#/practice/chat">Chat practice</button></div></div>';
  SE.bindGo(box);
  $('#gpMore', box).onclick = function () { SE.dispatch(); };
  KEYS = function (e) { if (e.key === 'Enter') { e.preventDefault(); SE.dispatch(); } };
}

/* ================================================================ 3. TROUBLE SPOTS */
/* ================================================================ CONVENTIONS GYM */
function gymLessons() { var c = ENG.courses.gym; return c ? c.levels : []; }
function gymItemIds() { var ITEMS = IX().ITEMS, out = []; Object.keys(ITEMS).forEach(function (id) { var x = L(ITEMS[id].lid); if (x && x.course.id === 'gym' && SE.GRADED[ITEMS[id].item.k]) out.push(id); }); return out; }
function gymStats(lid) { var ids = Object.keys(IX().ITEMS).filter(function (id) { return IX().ITEMS[id].lid === lid; }), st = S().items, seen = 0, right = 0, miss = 0; ids.forEach(function (id) { var r = st[id]; if (r) { seen++; if ((r.streak || 0) > 0) right++; if ((r.wrong || 0) > 0 && (r.streak || 0) < 3) miss++; } }); return { n: ids.length, seen: seen, right: right, miss: miss }; }
function runDrill(body, ids, o) {
  var R = window.SEPlayer; if (!R || !ids.length) return;
  var list = R.sortEntries(ids.map(function (id) { var x = IX().ITEMS[id], Lx = L(x.lid); return { it: x.item, id: id, tag: Lx && Lx.course.id === 'gym' ? 'Conventions gym · ' + plain(Lx.lesson.title) : sourceLabel(x.lid) }; }));
  body.innerHTML = '<div class="gym-run"><div class="gp-head"><div style="flex:1"><div class="eyebrow">' + esc(o.eyebrow) + '</div><h1 class="rv-h1">' + o.title + '</h1></div><button class="btn" data-go="' + o.back + '">' + esc(o.backLabel || 'Back') + '</button></div><div class="card lg gym-card"><div id="drHost"></div></div></div>';
  SE.bindGo(body);
  R.runner($('#drHost', body), list, { compact: true, label: o.eyebrow, onDone: function (st, host) {
    host.innerHTML = '<div class="pad"><h2 class="h2">' + st.first + ' of ' + st.total + ' <em>right the first time.</em></h2><p class="lead" style="margin-top:8px">' + (st.misses.length ? 'The ones you missed stay in your trouble spots and come back soon.' : 'Clean sweep. Nice.') + '</p>' + frl(st.misses.length ? 'Celles que tu as ratées restent dans tes points faibles et reviennent bientôt.' : 'Sans faute. Bravo.') + '<div class="rv-done-actions"><button class="btn primary" id="drAgain">Another round</button><button class="btn" data-go="' + o.back + '">' + esc(o.backLabel || 'Back') + '</button></div></div>';
    SE.bindGo(host); $('#drAgain', host).onclick = function () { SE.dispatch(); };
  } });
}
function gymMixed(n) {
  var st = S().items, now = Date.now();
  var ids = gymItemIds().map(function (id) { var r = st[id], sc = Math.random(); if (!r) sc += 2; else { if ((r.wrong || 0) > 0 && (r.streak || 0) < 3) sc += 4; if (r.due <= now) sc += 1.5; else sc -= 2; } return { id: id, s: sc }; }).sort(function (a, b) { return b.s - a.s; });
  var ch = ids.filter(function (x) { return IX().ITEMS[x.id].item.k === 'mcq'; }).slice(0, Math.ceil(n * 0.55)), ty = ids.filter(function (x) { return IX().ITEMS[x.id].item.k !== 'mcq'; }).slice(0, n - Math.ceil(n * 0.55));
  return ch.concat(ty).map(function (x) { return x.id; });
}
VIEWS.gym = function (body, args) {
  var lvs = gymLessons();
  if (args[0] === 'drill') return runDrill(body, gymMixed(12), { eyebrow: 'Conventions gym · mixed drill', title: 'The little words, <em>on repeat.</em>', back: '#/practice/gym', backLabel: 'All drills' });
  var all = [], trouble = 0;
  lvs.forEach(function (lv) { lv.lessons.forEach(function (l) { all.push(l); trouble += gymStats(l.id).miss; }); });
  var h = '<div class="gym"><div class="gp-head"><div style="flex:1"><div class="eyebrow">Conventions gym · ' + all.length + ' drills</div><h1 class="rv-h1">The little words that <em>make it sound right.</em></h1>' +
    '<p class="lead" style="margin-top:8px">Short, intense drills for what French speakers miss: <b>I’m going to</b>, <b>am / is / are</b>, <b>to</b>, <b>do / does</b>, <b>a / the</b>, <b>his / her</b>… Multiple choice first, then you type.</p>' + frl('Des exercices courts et intenses sur ce que les francophones oublient. D’abord des choix, puis tu écris.') + '</div></div>';
  if (!all.length) { body.innerHTML = h + '<div class="card pad gp-empty"><h3 class="h3">Drills are on their way.</h3><p class="lead" style="margin-top:6px">They will show up here as soon as they are added.</p></div></div>'; return; }
  h += '<div class="gym-mixed card lg"><div><div class="eyebrow rose">Mixed drill</div><div class="gym-mt serif">12 questions from every drill</div><div class="muted">Your missed questions first, then new ones.' + (trouble ? ' · <b>' + trouble + '</b> to fix' : '') + '</div></div><button class="btn primary lg" data-go="#/practice/gym/drill">Start mixed drill</button></div>';
  lvs.forEach(function (lv) {
    h += '<div class="gym-group"><div class="gym-gh"><h2 class="h3">' + esc(lv.title) + '</h2><span class="muted small">' + lv.lessons.length + ' drills</span></div><div class="gym-grid">';
    lv.lessons.forEach(function (l) {
      var gs = gymStats(l.id), ls = SE.lessonState(l.id), pct = gs.n ? Math.round(gs.right / gs.n * 100) : 0;
      h += '<a class="gym-p card" href="#/l/' + esc(l.id) + '" data-go="#/l/' + esc(l.id) + '"><span class="gym-ic">' + esc(l.icon || '•') + '</span><span class="gym-pt"><b>' + esc(plain(l.title)) + '</b><span class="muted small">' + (ls.state === 'finished' || ls.state === 'knew' ? SE.ui.stateTag(l.id) + ' ' : '') + (gs.seen ? pct + '% right' + (gs.miss ? ' · ' + gs.miss + ' to fix' : '') : 'New') + '</span></span><span class="gym-go">›</span></a>';
    });
    h += '</div></div>';
  });
  body.innerHTML = h + '</div>';
};
VIEWS.trouble = function (body, args) {
  if (args[0] === 'drill') return troubleDrill(body);
  var rows = troubleRows(40);
  var h = '<div class="tr-wrap"><div class="gp-head"><div style="flex:1"><div class="eyebrow">Trouble spots · ' + rows.length + '</div><h1 class="rv-h1">The ones that <em>keep tripping you.</em></h1>' +
    '<p class="lead" style="margin-top:8px">Questions you missed, most-missed first. Get one right 3 times in a row and it leaves this list.</p>' + frl('Les questions ratées, les plus ratées en premier. Réussis-en une 3 fois de suite et elle quitte la liste.') + '</div>' +
    (rows.length ? '<button class="btn primary lg" data-go="#/practice/trouble/drill">Practice these</button>' : '') + '</div>';
  if (!rows.length) h += '<div class="card pad gp-empty"><h3 class="h3">No trouble spots yet.</h3><p class="lead" style="margin-top:6px">When you miss a question in a lesson, it shows up here so you can fix it.</p></div>';
  else h += '<div class="card tr-list">' + rows.map(function (r) {
    return '<div class="tr-row"><div class="tr-main">' + (r.q ? '<div class="tr-q">' + esc(r.bad) + '</div><div class="tr-a">→ <b>' + esc(r.good) + '</b></div>' : '<div><span class="bad">' + esc(r.bad) + '</span> <span class="arr">→</span> <b class="good">' + esc(r.good) + '</b></div>') + '</div>' +
      '<div class="tr-meta"><span class="eyebrow">' + esc(sourceLabel(r.lid)) + '</span><span class="tr-miss">missed ' + r.miss + '×</span></div></div>';
  }).join('') + '</div>';
  body.innerHTML = h + '</div>';
};
function troubleDrill(body) {
  var ids = SE.troubleItems(12);
  if (!ids.length) { SE.go('#/practice/trouble'); return; }
  if (window.SEPlayer && window.SEPlayer.sortEntries) return runDrill(body, ids, { eyebrow: 'Trouble spots · ' + ids.length, title: 'Fix them <em>for good.</em>', back: '#/practice/trouble', backLabel: 'Back to the list' });
  var i = 0, right = 0;
  body.innerHTML = '<div class="tr-wrap"><div class="gp-head"><div style="flex:1"><div class="eyebrow" id="tdN"></div><h1 class="rv-h1">Fix them <em>for good.</em></h1></div><button class="btn" data-go="#/practice/trouble">Back to the list</button></div><div class="rv-bar thin"><i id="tdBar"></i></div><div id="tdBox" class="pr-q"></div></div>';
  SE.bindGo(body);
  function draw() {
    var box = $('#tdBox'); if (!box) return;
    $('#tdBar').style.width = Math.round(i / ids.length * 100) + '%';
    if (i >= ids.length) {
      $('#tdN').textContent = 'Done';
      box.innerHTML = '<div class="card pad"><h2 class="h2">' + right + ' of ' + ids.length + ' <em>right.</em></h2><p class="lead" style="margin-top:8px">Right answers move a question toward leaving your trouble list.</p><div class="rv-done-actions"><button class="btn primary" id="tdAgain">Practice again</button><button class="btn" data-go="#/practice/gap">Fill the gap</button></div></div>';
      SE.bindGo(box); $('#tdAgain', box).onclick = function () { SE.dispatch(); }; KEYS = null; return;
    }
    $('#tdN').textContent = 'Trouble spots · ' + (i + 1) + ' of ' + ids.length;
    var x = IX().ITEMS[ids[i]];
    box.innerHTML = '';
    var holder = el('<div class="card pad"></div>'); box.appendChild(holder);
    var card = SE.itemCard(x.item, i + 1, { id: ids[i], gloss: x.gloss, done: function (res) {
      if (res.first) right++;
      var nb = el('<div class="gp-foot"><span class="eyebrow">' + esc(sourceLabel(x.lid)) + '</span><span style="flex:1"></span><button class="btn primary">' + (i + 1 >= ids.length ? 'Finish' : 'Next') + ' →</button></div>');
      holder.appendChild(nb);
      var go = function () { i++; draw(); };
      $('button', nb).onclick = go;
      KEYS = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      if (res.first) setTimeout(function () { if (holder.isConnected && !holder._moved) { holder._moved = 1; go(); } }, 1500);
    } });
    holder.appendChild(card);
    var inp = $('input', card); if (inp) setTimeout(function () { inp.focus(); }, 30);
    KEYS = function (e) { var bs = $$('.opt:not([disabled])', card); if (/^[1-9]$/.test(e.key) && bs[+e.key - 1]) { e.preventDefault(); bs[+e.key - 1].click(); } };
  }
  draw();
}

/* ================================================================ 4. CHAT PRACTICE */
function chatScenes() {
  var started = startedLids(), plan = SE.planList(), seen = {}, out = [];
  var order = started.concat(plan).concat(Object.keys(IX().LESSONS));
  order.forEach(function (lid) {
    if (seen[lid] || !SE.lidVisible(lid)) return; seen[lid] = 1;
    var x = L(lid); if (!x) return;
    x.lesson.steps.forEach(function (st, si) {
      if (st.type === 'dialogue' && (st.lines || []).length >= 5) out.push({ lid: lid, si: si, kind: 'dialogue', title: st.title || x.lesson.title, img: st.img || x.lesson.img, n: st.lines.length, started: started.indexOf(lid) >= 0 });
      if (st.type === 'convo' && (st.turns || []).some(function (t) { return t.choices; })) out.push({ lid: lid, si: si, kind: 'convo', title: st.title || x.lesson.title, img: st.img || x.lesson.img, n: st.turns.length, started: started.indexOf(lid) >= 0 });
    });
  });
  return out;
}
var CH = null;
VIEWS.chat = function (body, args) {
  if (args[0] && L(args[0])) return chatRun(body, args[0], +args[1] || 0);
  var all = chatScenes(), q = (VIEWS.chat._q || '');
  var list = all.filter(function (s) { return !q || (s.title + ' ' + L(s.lid).lesson.title).toLowerCase().indexOf(q) >= 0; });
  var shown = list.slice(0, VIEWS.chat._n || 16);
  var h = '<div class="gp-head"><div style="flex:1"><div class="eyebrow">Chat practice</div><h1 class="rv-h1">Talk it <em>through.</em></h1><p class="lead" style="margin-top:8px">Real scenes from your lessons. Your lines have a missing word: pick it, and the chat keeps going.</p>' + frl('Des scènes de tes leçons. Dans tes répliques il manque un mot : choisis-le et la conversation continue.') + '</div>' +
    '<label class="search" style="width:280px"><span class="o"></span><input id="chQ" placeholder="Find a scene…" value="' + esc(q) + '"></label></div>' +
    '<div class="ch-grid">' + shown.map(function (s) {
      var x = L(s.lid);
      return '<button class="card ch-scene" data-go="#/practice/chat/' + s.lid + '/' + s.si + '">' + SE.ui.photo(s.img, 'ch-ph', s.title) +
        '<div class="ch-body"><div class="eyebrow">' + esc(levelShort(x)) + (s.started ? ' · <span class="rose-t">your lesson</span>' : '') + '</div><div class="ch-t">' + esc(plain(s.title)) + '</div>' +
        '<div class="ch-m">' + (s.kind === 'convo' ? 'Pick what to say' : 'Finish your lines') + ' · ' + s.n + ' lines</div></div></button>';
    }).join('') + '</div>' + (list.length > shown.length ? '<div style="text-align:center;margin-top:20px"><button class="btn" id="chMore">Show more scenes</button></div>' : '');
  body.innerHTML = h; SE.bindGo(body);
  var inp = $('#chQ', body); inp.oninput = function () { VIEWS.chat._q = this.value.toLowerCase(); VIEWS.chat._n = 16; var pos = this.selectionStart; SE.dispatch(); var ni = $('#chQ'); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); } };
  if ($('#chMore', body)) $('#chMore', body).onclick = function () { VIEWS.chat._n = (VIEWS.chat._n || 16) + 16; SE.dispatch(); };
};
function chatRun(body, lid, si) {
  var x = L(lid), st = x.lesson.steps[si];
  if (!st || (st.type !== 'dialogue' && st.type !== 'convo')) { SE.go('#/practice/chat'); return; }
  var turns = [], me = null;
  if (st.type === 'dialogue') {
    var sp = []; st.lines.forEach(function (l) { if (sp.indexOf(l.s) < 0) sp.push(l.s); });
    me = sp.filter(function (n) { return /^(you|claire)$/i.test(n); })[0] || sp[1] || sp[0];
    var vocab = []; st.lines.forEach(function (l) { tokenize(plain(l.t)).forEach(function (t, i) { if (i % 2 && t.length >= 4 && !STOP[nrm(t)]) vocab.push(t); }); });
    IX().WORDS.forEach(function (o) { if (o.lid === lid) vocab.push(headOf(o.w.w)); });
    vocab = uniq(vocab.filter(function (v) { return v && v.split(' ').length === 1; }));
    st.lines.forEach(function (l) {
      var t = plain(l.t);
      if (l.s === me) { var b = grammarBlank(t) || wordBlank(t, vocab); turns.push({ me: true, s: l.s, t: t, b: b }); }
      else turns.push({ me: false, s: l.s, t: t });
    });
  } else {
    st.turns.forEach(function (t) { if (t.choices) turns.push({ me: true, s: 'You', choices: t.choices }); else turns.push({ me: false, s: t.s, t: plain(t.t) }); });
  }
  var other = (turns.filter(function (t) { return !t.me; })[0] || {}).s || 'them';
  CH = { lid: lid, si: si, turns: turns, k: 0, right: 0, asked: 0, tries: 0, picked: null };
  var initial = (S().settings.name || 'Me').charAt(0).toUpperCase();
  body.innerHTML = '<div class="ch-run"><div class="gp-head"><div style="flex:1"><div class="eyebrow">Chat practice · ' + esc(levelShort(x)) + '</div><h1 class="rv-h1">' + esc(plain(st.title || x.lesson.title)) + '</h1></div><button class="btn" data-go="#/practice/chat">All scenes</button></div>' +
    '<div class="card lg ch-card"><div class="ch-photo">' + SE.ui.photo(st.img || x.lesson.img, 'ch-ph-big', st.title) + '<span class="ch-chip">CHAT · ' + esc((st.type === 'convo' ? 'PICK WHAT TO SAY' : 'FINISH YOUR LINES')) + '</span></div>' +
    '<div class="ch-in"><div class="ch-instr">Finish what you’d say to ' + esc(whoLabel(other)) + '.</div>' + frl('Complète ce que tu dirais.') +
    '<div class="ch-thread" id="chThread"></div><div id="chAsk"></div></div></div></div>';
  SE.bindGo(body);
  CH.initial = initial; CH.other = other;
  advanceChat();
}
var ROLES = /^(barista|cashier|waiter|waitress|server|doctor|receptionist|agent|officer|pharmacist|host|hostess|neighbor|mechanic|landlord|customer|patient|nurse|dentist|stylist|client|manager|clerk|teller|associate|interviewer|boss|coworker|roommate|driver|guest|bartender|hygienist|assistant|employee|friend)$/i;
function whoLabel(n) { if (!n || /^(you|claire)$/i.test(n)) return 'them'; return ROLES.test(n) ? 'the ' + n.toLowerCase() : n; }
function bubble(t, me, html) {
  var init = me ? CH.initial : (t.s || '?').charAt(0).toUpperCase();
  return '<div class="ch-line' + (me ? ' me' : '') + '"><span class="ch-av' + (me ? ' me' : '') + '">' + esc(init) + '</span><div class="ch-bub' + (me ? ' me' : '') + '"><div class="ch-txt">' + html + '</div>' +
    (!me ? '<div class="ch-listen"><button data-say1="' + esc(t.t) + '">▶ Listen</button> · <button data-say2="' + esc(t.t) + '">▶ Slower</button></div>' : '') + '</div></div>';
}
function wireListen(root) {
  $$('[data-say1]', root).forEach(function (b) { b.onclick = function () { SE.speak(b.getAttribute('data-say1')); }; });
  $$('[data-say2]', root).forEach(function (b) { b.onclick = function () { SE.speak(b.getAttribute('data-say2'), { slow: true }); }; });
}
function advanceChat() {
  var th = $('#chThread'), ask = $('#chAsk'); if (!th) return;
  while (CH.k < CH.turns.length) {
    var t = CH.turns[CH.k];
    if (!t.me) { th.insertAdjacentHTML('beforeend', bubble(t, false, esc(t.t))); CH.k++; continue; }
    if (t.choices || t.b) break;
    th.insertAdjacentHTML('beforeend', bubble(t, true, esc(t.t))); CH.k++;
  }
  wireListen(th);
  if (CH.k >= CH.turns.length) return chatDone(ask);
  var turn = CH.turns[CH.k]; CH.tries = 0; CH.asked++;
  if (turn.b) {
    var b = turn.b, before = b.parts.slice(0, b.pos).join(''), after = b.parts.slice(b.pos + 1).join('');
    th.insertAdjacentHTML('beforeend', '<div id="chCur">' + bubble(turn, true, esc(before) + '<span class="gp-blank" id="chBlank">&nbsp;</span>' + esc(after)) + '</div>');
    var choices = shuffle(b.choices.slice());
    ask.innerHTML = '<div class="ch-opts">' + choices.map(function (w, k) { return '<button class="ch-opt" data-w="' + esc(w) + '"><kbd>' + (k + 1) + '</kbd>' + esc(w) + '</button>'; }).join('') + '</div><div id="chFb"></div>' +
      '<div class="gp-foot"><button class="link-muted" id="chSkip">Skip this one</button></div>';
    $$('.ch-opt', ask).forEach(function (o) { o.onclick = function () { chatPick(o, o.getAttribute('data-w')); }; });
    KEYS = function (e) { var bs = $$('.ch-opt:not([disabled])', ask); if (/^[1-9]$/.test(e.key) && $$('.ch-opt', ask)[+e.key - 1]) { e.preventDefault(); var bt = $$('.ch-opt', ask)[+e.key - 1]; if (!bt.disabled) bt.click(); } };
  } else {
    var cs = shuffle(turn.choices.map(function (c, k) { return k; }));
    ask.innerHTML = '<div class="ch-opts col">' + cs.map(function (k, n) { return '<button class="ch-opt wide" data-k="' + k + '"><kbd>' + (n + 1) + '</kbd>' + esc(plain(turn.choices[k].t)) + '</button>'; }).join('') + '</div><div id="chFb"></div><div class="gp-foot"><button class="link-muted" id="chSkip">Skip this one</button></div>';
    $$('.ch-opt', ask).forEach(function (o) { o.onclick = function () { chatPickTurn(o, turn.choices[+o.getAttribute('data-k')]); }; });
    KEYS = function (e) { var bs = $$('.ch-opt', ask); if (/^[1-9]$/.test(e.key) && bs[+e.key - 1] && !bs[+e.key - 1].disabled) { e.preventDefault(); bs[+e.key - 1].click(); } };
  }
  $('#chSkip', ask).onclick = function () { var tt = CH.turns[CH.k]; var c = $('#chCur'); if (c) c.remove(); if (tt.b) th.insertAdjacentHTML('beforeend', bubble(tt, true, esc(tt.t))); else { var okc = tt.choices.filter(function (c) { return c.ok; })[0]; th.insertAdjacentHTML('beforeend', bubble({ s: 'You' }, true, esc(plain(okc.t)))); } CH.k++; ask.innerHTML = ''; advanceChat(); };
  ask.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function chatPick(btn, w) {
  var turn = CH.turns[CH.k], b = turn.b, ok = nrm(w) === nrm(b.answer);
  CH.tries++;
  var fb = $('#chFb');
  if (ok) {
    btn.classList.add('ok'); $$('.ch-opt').forEach(function (o) { o.disabled = true; });
    var bl = $('#chBlank'); bl.textContent = b.answer; bl.classList.add('ok');
    if (CH.tries === 1) { CH.right++; SE.addXP(SE.PTS.item.cloze || 2); }
    var e = b.set !== 'word' ? EXPL[b.set] : null;
    fb.innerHTML = '<div class="gp-fb ok"><div class="gp-fb-t">' + rnd(['Exactly right!', 'Yes!', 'Perfect.']) + '</div>' + (e && CH.tries > 1 ? '<div class="gp-fb-b">' + esc(e[0]) + '</div>' + frl(e[1]) : '') + '</div>';
    setTimeout(function () { var c = $('#chCur'); if (c) { c.removeAttribute('id'); var bl2 = $('#chBlank'); if (bl2) bl2.removeAttribute('id'); } CH.k++; var a = $('#chAsk'); if (a) { a.innerHTML = ''; advanceChat(); } }, CH.tries === 1 ? 900 : 1600);
  } else {
    btn.classList.add('no'); btn.disabled = true;
    var bl3 = $('#chBlank'); bl3.textContent = w; bl3.classList.add('no');
    setTimeout(function () { var b4 = $('#chBlank'); if (b4 && !b4.classList.contains('ok')) { b4.innerHTML = '&nbsp;'; b4.classList.remove('no'); } }, 900);
    var e2 = EXPL[b.set];
    fb.innerHTML = '<div class="gp-fb no"><div class="gp-fb-t">Not quite. Try again.</div>' + (e2 ? '<div class="gp-fb-b">' + esc(e2[0]) + '</div>' + frl(e2[1]) : '') + '</div>';
  }
}
function chatPickTurn(btn, c) {
  CH.tries++;
  var fb = $('#chFb');
  if (c.ok) {
    btn.classList.add('ok'); $$('.ch-opt').forEach(function (o) { o.disabled = true; });
    if (CH.tries === 1) { CH.right++; SE.addXP(SE.PTS.convo || 2); }
    fb.innerHTML = '<div class="gp-fb ok"><div class="gp-fb-t">' + rnd(['Exactly right!', 'Nice.', 'Perfect.']) + '</div>' + (c.fb ? '<div class="gp-fb-b">' + fmt(c.fb) + '</div>' : '') + '</div>';
    setTimeout(function () { var th = $('#chThread'); if (!th) return; th.insertAdjacentHTML('beforeend', bubble({ s: 'You' }, true, esc(plain(c.t)))); CH.k++; $('#chAsk').innerHTML = ''; advanceChat(); }, 1300);
  } else {
    btn.classList.add('no'); btn.disabled = true;
    fb.innerHTML = '<div class="gp-fb no"><div class="gp-fb-t">Not quite.</div>' + (c.fb ? '<div class="gp-fb-b">' + fmt(c.fb) + '</div>' : '') + '</div>';
  }
}
function chatDone(ask) {
  ask.innerHTML = '<div class="gp-fb ok" style="margin-top:20px"><div class="gp-fb-t">Conversation complete. ' + CH.right + ' of ' + CH.asked + ' right first time.</div></div>' +
    '<div class="rv-done-actions"><button class="btn primary" id="chAgain">Try it again</button><button class="btn" data-go="#/practice/chat">Another scene</button></div>';
  SE.bindGo(ask);
  $('#chAgain', ask).onclick = function () { SE.dispatch(); };
  KEYS = function (e) { if (e.key === 'Enter') { e.preventDefault(); SE.go('#/practice/chat'); } };
}

/* ================================================================ 5. SOUND GYM (optional, short) */
var PAIRS = [['ship', 'sheep'], ['live', 'leave'], ['think', 'sink'], ['three', 'tree'], ['hat', 'at'], ['heat', 'eat'], ['full', 'fool'], ['bed', 'bad'], ['walk', 'work'], ['thank', 'tank'], ['hair', 'air'], ['this', 'dis']];
var SAYS = ['I think it’s three thirty.', 'He has a huge house.', 'She’s going to the beach.', 'Can I have the check, please?', 'This sheep is on the ship.'];
VIEWS.sound = function (body) {
  var h = '<div class="gp-head"><div style="flex:1"><div class="eyebrow">Sound gym · optional</div><h1 class="rv-h1">The sounds French <em>doesn’t have.</em></h1><p class="lead" style="margin-top:8px">Short and optional: tap to hear pairs, then let the quiz play one. Which did you hear?</p>' + frl('Court et facultatif : écoute les paires, puis le quiz en joue une. Laquelle as-tu entendue ?') + '</div><button class="btn primary lg" id="sgQuiz">Quiz me (10)</button></div>' +
    '<div id="sgQuizBox"></div><div class="sg-grid">' + PAIRS.map(function (p) { return '<div class="card sg-pair"><button class="sg-w" data-say1="' + p[0] + '">▶ ' + p[0] + '</button><span class="sg-vs">vs</span><button class="sg-w" data-say1="' + p[1] + '">▶ ' + p[1] + '</button></div>'; }).join('') + '</div>' +
    '<details class="card pad sg-say"><summary><b>Say it out loud</b> <span class="muted small">· optional, uses the microphone</span></summary><div id="sgSay"></div></details>';
  body.innerHTML = h;
  wireListen(body);
  var det = $('.sg-say', body); det.addEventListener('toggle', function () { var b = $('#sgSay'); if (det.open && !b.childNodes.length) SAYS.forEach(function (t, i) { b.appendChild(SE.sentenceRow(t, i + 1, 'sg:' + i)); }); });
  $('#sgQuiz', body).onclick = function () { sgQuiz($('#sgQuizBox')); };
};
function sgQuiz(box) {
  var rounds = shuffle(PAIRS).slice(0, 10).map(function (p) { return { p: shuffle(p.slice()), say: rnd(p) }; }), i = 0, right = 0;
  function draw() {
    if (i >= rounds.length) { box.innerHTML = '<div class="card pad sg-quiz"><h3 class="h3">' + right + ' of ' + rounds.length + ' <em>heard right.</em></h3><div class="rv-done-actions"><button class="btn" id="sgAgain">Again</button></div></div>'; $('#sgAgain', box).onclick = function () { sgQuiz(box); }; KEYS = null; return; }
    var r = rounds[i];
    box.innerHTML = '<div class="card pad sg-quiz"><div class="eyebrow">Which did you hear? · ' + (i + 1) + ' of ' + rounds.length + '</div><div class="sg-q"><button class="btn" id="sgPlay">▶ Play again</button></div><div class="ch-opts">' + r.p.map(function (w, k) { return '<button class="ch-opt" data-w="' + w + '"><kbd>' + (k + 1) + '</kbd>' + w + '</button>'; }).join('') + '</div><div id="sgFb"></div></div>';
    SE.speak(r.say, { slow: true });
    $('#sgPlay', box).onclick = function () { SE.speak(r.say, { slow: true }); };
    $$('.ch-opt', box).forEach(function (b) { b.onclick = function () {
      var ok = b.getAttribute('data-w') === r.say; if (ok) right++;
      $$('.ch-opt', box).forEach(function (o) { o.disabled = true; if (o.getAttribute('data-w') === r.say) o.classList.add('ok'); });
      if (!ok) b.classList.add('no');
      $('#sgFb', box).innerHTML = '<div class="gp-fb ' + (ok ? 'ok' : 'no') + '"><div class="gp-fb-t">' + (ok ? 'Yes!' : 'It was “' + r.say + '”.') + '</div></div>';
      setTimeout(function () { i++; draw(); }, ok ? 800 : 1500);
    }; });
    KEYS = function (e) { var bs = $$('.ch-opt', box); if (/^[12]$/.test(e.key) && bs[+e.key - 1] && !bs[+e.key - 1].disabled) { e.preventDefault(); bs[+e.key - 1].click(); } };
  }
  draw();
}

/* ================================================================ 6. WORDS & PHRASES (3f) */
var WP = { cat: 'all', q: '', n: 40 };
function isFaux(e) { var x = e.lid ? L(e.lid) : null; return /faux ami|false friend|≠|not “actuellement”/i.test((e.note || '') + ' ' + (x ? x.lesson.title + ' ' + x.level.title : '')); }
function wpCats(all) {
  var cats = [['all', 'All', all.length]];
  var pc = {}; all.forEach(function (e) { if (e.kind === 'phrase') pc[e.cat] = (pc[e.cat] || 0) + 1; });
  var lv = {}, lvOrder = [];
  all.forEach(function (e) { if (e.kind !== 'word') return; var x = L(e.lid); var k = x.level.id; if (!lv[k]) { lv[k] = { n: 0, label: levelShort(x) }; lvOrder.push(k); } lv[k].n++; });
  var faux = all.filter(isFaux).length, saved = Object.keys(S().saved || {}).filter(function (k) { return S().saved[k]; }).length;
  return { top: cats, phrases: Object.keys(pc).map(function (c) { return ['cat:' + c, c, pc[c]]; }), levels: lvOrder.map(function (k) { return ['lv:' + k, lv[k].label, lv[k].n]; }), extra: [].concat(faux ? [['faux', 'Faux amis', faux]] : []).concat([['saved', 'Saved by me', saved]]) };
}
function wpFilter(all) {
  var c = WP.cat, q = nrm(WP.q.trim());
  return all.filter(function (e) {
    if (c === 'saved' && !(S().saved || {})[e.cid]) return false;
    if (c === 'faux' && !isFaux(e)) return false;
    if (c.indexOf('cat:') === 0 && !(e.kind === 'phrase' && e.cat === c.slice(4))) return false;
    if (c.indexOf('lv:') === 0 && !(e.kind === 'word' && L(e.lid).level.id === c.slice(3))) return false;
    if (q && nrm(e.en + ' ' + (e.fr || '') + ' ' + (e.note || '')).indexOf(q) < 0) return false;
    return true;
  });
}
VIEWS.words = function (body) {
  var all = allEntries(), cats = wpCats(all);
  function catRow(c) { return '<button class="wp-cat' + (WP.cat === c[0] ? ' on' : '') + '" data-c="' + esc(c[0]) + '"><span>' + esc(c[1]) + '</span><span class="n">' + c[2] + '</span></button>'; }
  var side = '<aside class="wp-side"><div class="eyebrow">Categories</div><div class="wp-cats">' + cats.top.map(catRow).join('') + '</div>' +
    '<div class="eyebrow wp-sub">Phrasebook</div><div class="wp-cats">' + cats.phrases.map(catRow).join('') + '</div>' +
    '<div class="eyebrow wp-sub">Lesson words</div><div class="wp-cats">' + cats.levels.map(catRow).join('') + '</div>' +
    '<div class="wp-cats" style="margin-top:10px">' + cats.extra.map(catRow).join('') + '</div>' +
    '<div class="wp-tip">Tap <b>Save</b> on any word and it lands in <b>Saved by me</b>, ready for review cards.</div></aside>';
  var frOn = SE.frOn();
  var main = '<div class="wp-main"><div class="wp-head"><div style="flex:1;min-width:240px"><h1 class="wp-h1">Words &amp; <em>phrases</em></h1><p class="lead" style="margin-top:10px">' + all.length + ' from your lessons and the phrasebook. Each one is grouped by situation, not by alphabet.</p></div>' +
    '<label class="search wp-search"><span class="o"></span><input id="wpQ" placeholder="Search in English or French" value="' + esc(WP.q) + '"></label>' +
    '<button class="wp-frpill' + (frOn ? ' on' : '') + '" id="wpFr">French ' + (frOn ? 'on' : 'off') + '</button></div>' +
    '<select class="field wp-catsel" id="wpCatSel">' + [].concat(cats.top, cats.phrases, cats.levels, cats.extra).map(function (c) { return '<option value="' + esc(c[0]) + '"' + (WP.cat === c[0] ? ' selected' : '') + '>' + esc(c[1]) + ' (' + c[2] + ')</option>'; }).join('') + '</select>' +
    '<div class="wp-list" id="wpList"></div></div>';
  body.innerHTML = '<div class="wp-grid">' + side + main + '</div>';
  $$('.wp-cat', body).forEach(function (b) { b.onclick = function () { WP.cat = b.getAttribute('data-c'); WP.n = 40; SE.dispatch(); }; });
  $('#wpCatSel', body).onchange = function () { WP.cat = this.value; WP.n = 40; SE.dispatch(); };
  $('#wpFr', body).onclick = function () { SE.setFrench(!SE.frOn()); var b = $('#wpFr'); var on = SE.frOn(); b.textContent = 'French ' + (on ? 'on' : 'off'); b.classList.toggle('on', on); };
  $('#wpQ', body).oninput = function () { WP.q = this.value; WP.n = 40; drawWpList(all); };
  drawWpList(all);
};
function drawWpList(all) {
  var box = $('#wpList'); if (!box) return;
  var list = wpFilter(all), shown = list.slice(0, WP.n);
  if (!list.length) { box.innerHTML = '<div class="card pad gp-empty">' + (WP.cat === 'saved' ? 'Nothing saved yet. Tap <b>Save</b> on any word or phrase.' : 'No matches.') + '</div>'; return; }
  box.innerHTML = shown.map(function (e) {
    var m = SE.mastery(e.cid), saved = !!(S().saved || {})[e.cid];
    var from = e.kind === 'word' ? sourceLabel(e.lid) : (e.cat || 'Phrasebook');
    var dots = ''; for (var i = 0; i < 5; i++) dots += '<i class="' + (i < m.n ? 'on' : '') + '"></i>';
    return '<div class="card wp-row"><div class="wp-txt"><div class="wp-en">' + esc(plain(e.en)) + '</div>' + (e.fr ? frl(e.fr, 'wp-fr') : '') + '<div class="wp-note">' + fmt(e.note || '') + (e.reply ? ' <span class="muted">· They answer: “' + esc(plain(e.reply)) + '”</span>' : '') + '</div></div>' +
      '<div class="wp-mast"><div class="eyebrow">' + esc(from) + '</div><div class="wp-dots">' + dots + '</div><div class="wp-lvl">' + m.label + '</div><button class="wp-save' + (saved ? ' on' : '') + '" data-save="' + esc(e.cid) + '">' + (saved ? 'Saved' : 'Save') + '</button></div>' +
      '<button class="wp-play" data-say1="' + esc(plain(e.en)) + '" aria-label="Listen">▶</button></div>';
  }).join('') + (list.length > shown.length ? '<div style="text-align:center;margin-top:8px"><button class="btn" id="wpMore">Show more (' + (list.length - shown.length) + ' left)</button></div>' : '');
  wireListen(box);
  $$('[data-save]', box).forEach(function (b) { b.onclick = function () { var cid = b.getAttribute('data-save'), on = !(S().saved || {})[cid]; SE.saveCard(cid, on); b.classList.toggle('on', on); b.textContent = on ? 'Saved' : 'Save'; SE.toast(on ? 'Saved for review cards' : 'Removed from saved'); }; });
  if ($('#wpMore', box)) $('#wpMore', box).onclick = function () { WP.n += 40; drawWpList(all); };
}

/* ================================================================ 7. TEST-OUT CENTER */
VIEWS.tests = function (body) {
  var h = '<div class="gp-head"><div style="flex:1"><div class="eyebrow">Test-out center</div><h1 class="rv-h1">Skip what you <em>already know.</em></h1><p class="lead" style="margin-top:8px">Pass a short test with 80% and the lesson or level is marked as known. Nothing is ever locked.</p>' + frl('Réussis un court test à 80 % et la leçon ou le niveau est marqué comme acquis. Rien n’est jamais bloqué.') + '</div></div>' +
    '<div class="card tint to-place"><div style="flex:1"><b>Not sure where to start?</b><div class="small" style="margin-top:4px;color:var(--body)">The placement check takes about 12 minutes and marks the lessons you already know.</div></div><button class="btn primary" data-go="#/placement">Take the check</button></div>';
  SE.visibleCourses().forEach(function (cid) {
    var c = ENG.courses[cid]; if (!c || !c.levels.length) return;
    h += '<div class="to-sec"><h2 class="h2s">' + esc(c.title) + '</h2><span class="muted small">' + esc(c.blurb || '') + '</span></div><div class="to-grid">';
    c.levels.forEach(function (lv, li) {
      var p = SE.levelPct(lv), kp = SE.levelKnewPct(lv);
      var label = cid === 'path' ? 'Level ' + (li + 1) : cid === 'school' ? 'Grade ' + (li + 1) : (lv.cefr || '');
      h += '<div class="card to-lv"><div class="to-lv-h">' + SE.ui.ring(p, 54, '<b style="font-size:20px">' + (cid === 'path' || cid === 'school' ? li + 1 : '') + '</b>', { lav: kp }) +
        '<div style="flex:1;min-width:0"><div class="eyebrow">' + esc(label) + (lv.cefr && label !== lv.cefr ? ' · ' + esc(lv.cefr) : '') + '</div><div class="to-lv-t">' + esc(lv.title) + '</div><div class="small muted">' + p + '% done</div></div>' +
        '<button class="btn sm" data-go="#/test/level/' + lv.id + '">Test out</button></div>' +
        '<details class="to-ls"><summary>' + lv.lessons.length + ' lessons</summary>' + lv.lessons.map(function (ls) {
          var st = SE.lessonState(ls.id);
          return '<div class="to-row"><span class="to-dot ' + st.state + '"></span><span class="to-rt">' + esc(ls.title) + '</span><span class="to-rl">' + esc(st.label) + '</span><a class="link small" data-go="#/test/lesson/' + ls.id + '">' + (st.state === 'knew' ? 'Retake' : 'Test out') + '</a></div>';
        }).join('') + '</details></div>';
    });
    h += '</div>';
  });
  body.innerHTML = h; SE.bindGo(body);
};

})();
