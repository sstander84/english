/* =========================================================
   Sunshine English: lesson player, test-outs, placement check (v4)
   Routes: #/l/<lid>/<step?>  ·  #/test/lesson/<lid>  ·  #/test/level/<levelId>  ·  #/placement
   Uses window.SE (js/core.js). Styles: css/player.css.
   ========================================================= */
(function () {
'use strict';
var SE = window.SE;
if (!SE) return;
var $ = SE.$, $$ = SE.$$, esc = SE.esc, fmt = SE.fmt, plain = SE.plain, el = SE.el, shuffle = SE.shuffle;
var C = SE.C;

/* ---------------------------------------------------------------- helpers */
var GR = { mcq: 1, pic: 1, type: 1, fix: 1, order: 1, listen: 1 };
var FR = {
  type: ['Fill in the blank.', 'Complète la phrase.'],
  fix: ['Fix the mistake.', 'Corrige l’erreur.'],
  order: ['Put the words in order.', 'Remets les mots dans l’ordre.'],
  listen: ['Listen and type what you hear.', 'Écoute et écris ce que tu entends.'],
  describe: ['Describe the photo.', 'Décris la photo.'],
  chat: ['Finish what you’d say.', 'Complète ce que tu dirais.'],
  pic: ['Choose the photo.', 'Choisis la photo.']
};
var PRAISE = ['Nice!', 'Exactly.', 'You got it.', 'Perfect.', 'That’s it!', 'Well done.'];
var STOP = ('the a an and or but to of in on at for with from by is are was were be been am i you he she it we they me my your his her our their this that these those do does did have has had not no yes so very just can could will would should what when where who how why there here then than as if up out about into over all some any').split(' ');
var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function S() { return SE.state(); }
function frFmt(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*(?!\s)([^*\n]{1,160}?)\*(?![*\w])/g, '$1<em>$2</em>'); }
function frl(fr, cls) { return fr ? '<div class="fr-line nogloss ' + (cls || '') + '">' + frFmt(fr) + '</div>' : ''; }
function frf(fr) { return fr ? '<div class="fr-line nogloss">' + frFmt(fr) + '</div>' : ''; }
function stripMarks(t) { return String(t || '').replace(/\*\*/g, '').replace(/[\[\]{}]/g, ''); }
function isMe(name, sp) { return /^(you|claire)$/i.test(name || '') || (sp && sp.length > 1 && name === sp[1] && !sp.some(function (n) { return /^(you|claire)$/i.test(n); })); }
function speakers(lines) { var s = []; (lines || []).forEach(function (l) { if (l.s && s.indexOf(l.s) < 0) s.push(l.s); }); return s; }
function initial() { var n = (S().settings.name || 'M'); return n.charAt(0).toUpperCase(); }
function listenLinks(t) { return '<div class="pl-listen"><button data-say="' + esc(plain(t)) + '">▶ Listen</button> · <button data-say="' + esc(plain(t)) + '" data-slow="1">▶ Slower</button></div>'; }
function strip(key, label, cls) {
  var im = SE.imgRec(key);
  return '<div class="pl-strip ' + (cls || '') + '">' + (im ? '<div class="pl-strip-img' + SE.illusCls(im) + '" style="background-image:url(\'' + esc(im.u) + '\')"></div>' : '<div class="pl-strip-ph">' + (key === 'x' || !key ? (P && P.ls && P.ls.icon ? '<span class="pl-strip-ic">' + esc(P.ls.icon) + '</span>' : '') : esc(String(key || '').replace(/^[a-z]+\d?_/, '').replace(/_/g, ' '))) + '</div>') + (label ? '<span class="pl-chip">' + esc(label) + '</span>' : '') + '</div>';
}
var KEYH = null;
document.addEventListener('keydown', function (e) { if (KEYH) KEYH(e); });
SE.on('route', function (r) { if (!/^(l|test|placement)$/.test(r.name)) { document.body.classList.remove('focus'); KEYH = null; } });
SE.on('change', function () {
  var c = $('#plpts'); var s = SE.session(); if (c && s) c.textContent = '+' + s.n + ' pts';
  var f = $('#plfr'); if (f) { f.textContent = 'FR ' + (SE.frOn() ? 'on' : 'off'); f.classList.toggle('off', !SE.frOn()); }
});

/* ---------------------------------------------------------------- ordering: choices first, then tiles, then typing */
function kindRank(k) { return (k === 'mcq' || k === 'pic' || k === 'chat') ? 0 : k === 'order' ? 1 : (k === 'type' || k === 'fix' || k === 'listen') ? 2 : 3; }
function sortEntries(list) { return list.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return (kindRank(a.x.it.k) - kindRank(b.x.it.k)) || (a.i - b.i); }).map(function (o) { return o.x; }); }

/* ---------------------------------------------------------------- wrong-answer walkthrough: word diff + why (or a generated why) */
function dispTokens(s) { return String(s || '').replace(/\*\*/g, '').trim().split(/\s+/).filter(Boolean); }
function normToks(tok) { var n = C.norm(tok); return n ? n.split(' ') : []; }
function alignDiff(mine, right) {
  /* returns {a:[{t,bad}], b:[{t,miss}], missing:[], extra:[]} aligning on normalized words */
  var A = dispTokens(mine), B = dispTokens(right), an = [], bn = [];
  A.forEach(function (t, i) { normToks(t).forEach(function (n) { an.push({ n: n, i: i }); }); });
  B.forEach(function (t, i) { normToks(t).forEach(function (n) { bn.push({ n: n, i: i }); }); });
  var m = an.length, n = bn.length, L = [], i, j;
  for (i = 0; i <= m; i++) { L.push(new Array(n + 1).fill(0)); }
  for (i = m - 1; i >= 0; i--) for (j = n - 1; j >= 0; j--) L[i][j] = an[i].n === bn[j].n ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  var ma = {}, mb = {}; i = 0; j = 0;
  while (i < m && j < n) { if (an[i].n === bn[j].n) { ma[i] = 1; mb[j] = 1; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  var badA = {}, missB = {}, missing = [], extra = [];
  an.forEach(function (x, k) { if (!ma[k]) { badA[x.i] = 1; extra.push(x.n); } });
  bn.forEach(function (x, k) { if (!mb[k]) { missB[x.i] = 1; missing.push(x.n); } });
  return { a: A.map(function (t, k) { return { t: t, bad: !!badA[k] }; }), b: B.map(function (t, k) { return { t: t, miss: !!missB[k] }; }), missing: missing, extra: extra, score: L[0][0] - 0.5 * (m + n - 2 * L[0][0]) };
}
function closestAnswer(mine, answers) {
  var best = null; C.arr(answers).forEach(function (a) { var d = alignDiff(mine, plain(a)); if (!best || d.score > best.d.score) best = { a: plain(a), d: d }; });
  return best;
}
var LITTLE = [
  { has: ['am', 'is', 'are'], en: 'English needs **am / is / are** before a describing word, a place, a job or an -ing word: *I am tired*, *She is a nurse*, *I’m going*.', fr: 'L’anglais a besoin de **am / is / are** devant un adjectif, un lieu, un métier ou un mot en -ing : *I am tired*, *She is a nurse*.' },
  { has: ['going'], en: 'For a plan, English uses **I’m going to** + verb: *I’m going to call her tomorrow*. “I go” is only for habits.', fr: 'Pour un projet : **I’m going to** + verbe : *I’m going to call her tomorrow*. « I go », c’est pour les habitudes.' },
  { has: ['to'], en: 'After want, need, have, going, try, like and would like comes **to** + verb: *I want to go*, *I need to call*.', fr: 'Après want, need, have, going, try, like, would like : **to** + verbe : *I want to go*, *I need to call*.' },
  { has: ['do', 'does', 'did'], en: 'Questions and “not” sentences need **do / does / did**: *Do you like it?*, *She doesn’t work here*, *Did you go?*', fr: 'Les questions et les phrases avec « not » ont besoin de **do / does / did** : *Do you like it?*, *She doesn’t work here*.' },
  { has: ['not'], en: 'To say no, English puts **not** after the little verb: *I’m not*, *I don’t*, *she can’t*. Never “I no like”.', fr: 'Pour la négation : **not** après le petit verbe : *I’m not*, *I don’t*, *she can’t*. Jamais « I no like ».' },
  { has: ['will'], en: 'For a quick decision, an offer or a promise: **I’ll** + verb: *I’ll call you back*.', fr: 'Décision rapide, proposition ou promesse : **I’ll** + verbe : *I’ll call you back*.' },
  { has: ['have', 'has'], en: '**have / has** + past form talks about something that started before and is still true: *I’ve lived here for two years*.', fr: '**have / has** + participe : quelque chose qui a commencé avant et qui est encore vrai : *I’ve lived here for two years*.' },
  { has: ['the'], en: 'Use **the** for one specific thing you both know: *the bathroom*, *the store on Dale Mabry*.', fr: 'On met **the** pour une chose précise que les deux connaissent : *the bathroom*.' },
  { has: ['a', 'an'], en: 'Use **a / an** for one thing, a job, or the first time you mention something: *She’s a nurse*, *I have an appointment*.', fr: 'On met **a / an** pour une chose, un métier, ou la première fois qu’on en parle : *She’s a nurse*.' },
  { has: ['it'], en: 'English always needs a subject. For weather, time and distance it’s **it**: *It’s raining*, *It’s far*.', fr: 'L’anglais a toujours besoin d’un sujet : *It’s raining*, *It’s far* (jamais « Is raining »).' },
  { has: ['there'], en: 'To say something exists, use **there is / there are**: *There’s a pharmacy near here*.', fr: 'Pour dire « il y a » : **there is / there are** : *There’s a pharmacy near here*.' },
  { has: ['was', 'were'], en: 'In the past, am/is becomes **was** and are becomes **were**: *I was tired*, *They were late*.', fr: 'Au passé : am/is → **was**, are → **were** : *I was tired*, *They were late*.' }
];
var EXTRA = [
  { has: ['the'], en: 'No **the** for things in general: *I love dogs*, *Life is short*, *Coffee is expensive*.', fr: 'Pas de **the** pour parler en général : *I love dogs*, *Life is short*.' },
  { has: ['to'], en: 'No **to** after can, could, should, must, will: *I can swim*, *You should call*.', fr: 'Pas de **to** après can, could, should, must, will : *I can swim*.' },
  { has: ['of'], en: 'English often says it without **of**: *my sister’s car* (not the car of my sister).', fr: 'L’anglais dit souvent sans **of** : *my sister’s car*.' },
  { has: ['have', 'has'], en: 'Age and feelings use **be**, not have: *I’m 30*, *I’m hungry*, *I’m cold*.', fr: 'L’âge et les sensations se disent avec **be** : *I’m 30*, *I’m hungry*.' }
];
function hasAny(list, words) { return words.filter(function (w) { return list.indexOf(w) >= 0; }); }
function genWhy(d) {
  var out = [];
  /* -s on he/she/it */
  d.missing.forEach(function (w) { d.extra.forEach(function (x) { if ((w === x + 's' || w === x + 'es') && out.length < 2) out.push({ en: 'With he / she / it (one person), the verb takes **-s**: *she works*, *he goes*, *it costs*. So “' + x + '” becomes “' + w + '”.', fr: 'Avec he / she / it, le verbe prend un **-s** : *she works*, *he goes*. Donc « ' + x + ' » devient « ' + w + ' ».' }); if ((x === w + 's' || x === w + 'es') && out.length < 2) out.push({ en: 'After do / does / did, can, will or to, the verb stays simple (no -s): *Does she work?*, *She can drive*. So “' + x + '” becomes “' + w + '”.', fr: 'Après do / does / did, can, will ou to, le verbe reste simple (sans -s). Donc « ' + x + ' » devient « ' + w + ' ».' }); }); });
  LITTLE.forEach(function (r) { var h = hasAny(d.missing, r.has); if (h.length && out.length < 3) out.push({ en: 'You left out “' + h.join(', ') + '”. ' + r.en, fr: 'Il manquait « ' + h.join(', ') + ' ». ' + r.fr }); });
  EXTRA.forEach(function (r) { var h = hasAny(d.extra, r.has); if (h.length && !hasAny(d.missing, r.has).length && out.length < 3) out.push({ en: '“' + h.join(', ') + '” isn’t needed here. ' + r.en, fr: '« ' + h.join(', ') + ' » est en trop ici. ' + r.fr }); });
  if (!out.length) out.push({ en: 'Compare the two sentences word by word: the **green** words are what English needs here, the **red** ones don’t fit. Then read the right answer out loud once.', fr: 'Compare les deux phrases mot à mot : les mots en **vert** sont ceux qu’il faut, ceux en **rouge** ne vont pas. Puis lis la bonne réponse à voix haute.' });
  return out;
}
/* strict items (its / it's, your / you're…): apostrophes count, typos don't pass */
function strictNorm(x) { return String(x || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”"]/g, '').replace(/[,;:!?.]+(?=\s)/g, '').replace(/\s+/g, ' ').replace(/[\s.!?,;:]+$/, '').trim(); }
function strictCheck(input, answers, wrong) {
  var n = strictNorm(input), a = C.arr(answers);
  for (var i = 0; i < a.length; i++) if (strictNorm(a[i]) === n) return { ok: true, best: a[i] };
  return { ok: false, best: a[0], same: wrong && strictNorm(wrong) === n };
}
function lightHint(mine, it) {
  var ca = closestAnswer(mine, it.a); if (!ca) return ['', ''];
  var d = ca.d, little = ['am', 'is', 'are', 'to', 'do', 'does', 'did', 'the', 'a', 'an', 'not', 'will', 'have', 'has', 'it', 'going', 'was', 'were'];
  var lm = hasAny(d.missing, little), lx = hasAny(d.extra, little);
  if (lm.length || lx.length) return ['Check the little words (am / is / are, to, do / does, a / the…). One of them is missing or extra.', 'Vérifie les petits mots (am / is / are, to, do / does, a / the…) : il en manque un ou il y en a un de trop.'];
  if (d.missing.length + d.extra.length <= 2) return ['You’re very close: just one word is different. Check the verb form (-s, -ed, -ing).', 'Tu y es presque : un seul mot change. Vérifie la forme du verbe (-s, -ed, -ing).'];
  return it.k === 'fix' ? ['Look closely at the verbs, the little words and the word order.', 'Regarde bien les verbes, les petits mots et l’ordre des mots.'] : ['', ''];
}
function diffHTML(d) {
  return '<div class="wk-row"><span class="wk-l">Your answer</span><span class="wk-s">' + d.a.map(function (x) { return x.bad ? '<del>' + esc(x.t) + '</del>' : esc(x.t); }).join(' ') + '</span></div>' +
    '<div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s">' + d.b.map(function (x) { return x.miss ? '<ins>' + esc(x.t) + '</ins>' : esc(x.t); }).join(' ') + '</span></div>' +
    (d.missing.length ? '<div class="wk-left">You left out: ' + d.missing.map(function (w) { return '<b>' + esc(w) + '</b>'; }).join(', ') + '</div>' : '');
}
/* "Let’s walk through it": comparison + numbered steps (item.walk, or built from why + the diff) + the right sentence */
function splitSents(t) {
  t = String(t || '').trim(); if (!t) return [];
  var parts = t.replace(/([.!?…])\s+(?=[A-Z“"*(«¿])/g, '$1\u0001').split('\u0001');
  var out = [];
  parts.forEach(function (x) { x = x.trim(); if (!x) return; if (out.length && (x.length < 28 || out[out.length - 1].length < 22)) out[out.length - 1] += ' ' + x; else out.push(x); });
  return out;
}
function fullRight(it, right) {
  var q = plain(it.q || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if ((it.k === 'type' || it.k === 'mcq') && (q.match(/_{3,}/g) || []).length === 1 && dispTokens(right).length <= 6) {
    var m = q.match(/^(.*?[:?!])\s+(?=[A-Z“"].*_{3,})/); if (m && m[1].indexOf('___') < 0) q = q.slice(m[0].length);
    return q.replace(/_{3,}/, right).replace(/^["“]|["”]$/g, '');
  }
  return right;
}
function safeHint(text, it, right) {
  /* a hint must not give the answer away */
  var t = C.norm(plain(text || '')), r = C.norm(plain(right || ''));
  if (!t) return '';
  if (r && r.length > 2 && (' ' + t + ' ').indexOf(' ' + r + ' ') >= 0) return '';
  return text;
}
function hintFor(it, right) {
  if (it.walk && it.walk.length) { var h = safeHint(it.walk[0], it, right); if (h) return h; }
  var s = splitSents(it.why)[0]; return s ? safeHint(s, it, right) : '';
}
function compareHTML(it, mine, right) {
  var gapQ = it.k === 'type' && /___/.test(it.q || '') && dispTokens(right).length <= 4;
  var single = dispTokens(right).length <= 2 && dispTokens(mine).length <= 2;
  var d = mine && right && !single && !gapQ ? alignDiff(mine, right) : null;
  if (d) { var common = d.b.filter(function (x) { return !x.miss; }).length; if (common < Math.max(1, d.b.length * 0.4)) d = null; }
  var h = '', dg = null;
  if (gapQ) {
    var q = plain(it.q).replace(/\s*\([^)]*\)\s*$/, ''), at = q.indexOf('___'), pre = esc(q.slice(0, at)), post = esc(q.slice(at + 3));
    h += '<div class="wk-row"><span class="wk-l">Your answer</span><span class="wk-s">' + pre + '<del>' + esc(mine || '…') + '</del>' + post + '</span></div>' +
      '<div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s">' + pre + '<ins>' + esc(right) + '</ins>' + post + '</span></div>';
    dg = alignDiff(mine, right); if (!(dg.missing.length || dg.extra.length)) dg = null;
  }
  else if (mine && it.k === 'mcq' && (plain(it.q || '').match(/_{3,}/g) || []).length === 1 && dispTokens(right).length <= 6) {
    var q2 = plain(it.q || '');
    {
      var qq = q2.replace(/\s*\([^)]*\)\s*$/, ''), at2 = qq.indexOf('___');
      h += '<div class="wk-row"><span class="wk-l">You chose</span><span class="wk-s">' + esc(qq.slice(0, at2)) + '<del>' + esc(mine) + '</del>' + esc(qq.slice(at2 + 3)) + '</span></div><div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s">' + esc(qq.slice(0, at2)) + '<ins>' + esc(right) + '</ins>' + esc(qq.slice(at2 + 3)) + '</span></div>';
      var dm = alignDiff(mine, right); if (dm.missing.length || dm.extra.length) dg = dm;
    }
  }
  else if (d) { h += diffHTML(d); dg = d; }
  else if (mine) h += '<div class="wk-row"><span class="wk-l">' + (it.k === 'mcq' || it.k === 'chat' || it.k === 'pic' ? 'You chose' : 'Your answer') + '</span><span class="wk-s"><del>' + esc(mine) + '</del></span></div><div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s"><ins>' + esc(right) + '</ins></span></div>';
  else if (right) h += '<div class="wk-row"><span class="wk-l">Right answer</span><span class="wk-s"><ins>' + esc(right) + '</ins></span></div>';
  return { html: h, d: dg };
}
function stepsHTML(steps, frAll) {
  return '<ol class="wk-steps">' + steps.map(function (st) { return '<li class="wk-step"><span class="wk-n" aria-hidden="true"></span><div class="wk-b"><div class="wk-p">' + fmt(st.en) + '</div>' + (st.fr ? frf(st.fr) : '') + '</div></li>'; }).join('') + '</ol>' + (frAll ? '<div class="wk-fr">' + frf(frAll) + '</div>' : '');
}
function walkthrough(it, mine, right) {
  var cmp = compareHTML(it, mine, right);
  var steps = [], frAll = '';
  if (it.walk && it.walk.length) {
    steps = it.walk.map(function (x) { return { en: x }; });
    frAll = it.walkFr || it.whyFr || '';
  } else {
    var ws = splitSents(it.why).slice(0, 3);
    ws.forEach(function (x) { steps.push({ en: x }); });
    frAll = it.whyFr || '';
    if (cmp.d && ws.length < 2) {
      var gen = genWhy(cmp.d), fallback = /Compare the two sentences/.test(gen[0] && gen[0].en || '');
      if (!(fallback && steps.length)) gen.slice(0, steps.length ? 1 : 2).forEach(function (g) { if (steps.length < 4) steps.push({ en: g.en, fr: g.fr }); });
    }
    if (!steps.length) steps.push({ en: 'The answer is **' + plain(right) + '**. Read it once out loud and notice what’s different from your answer.', fr: 'La bonne réponse : « ' + plain(right) + ' ». Lis-la une fois à voix haute et repère ce qui change.' });
  }
  var full = plain(fullRight(it, right));
  var h = '<div class="walk"><div class="wk-head"><span class="wk-ic" aria-hidden="true">↳</span><span class="wk-title">Let’s walk through it</span><span class="wk-titlefr fr-line nogloss">On décortique</span></div>' +
    (cmp.html ? '<div class="wk-cmp">' + cmp.html + '</div>' : '') +
    stepsHTML(steps, frAll) +
    (full ? '<div class="wk-final"><span class="wk-l">The right sentence</span><span class="wk-fs">' + esc(full) + '</span><button class="wk-say" data-say="' + esc(full) + '" title="Listen">▶ Listen</button></div>' : '') +
    '</div>';
  return h;
}

/* ---------------------------------------------------------------- chat + multiple choice: generated from dialogues */
function lessonVocab(ls) {
  var out = [];
  ls.steps.forEach(function (st) {
    if (st.type === 'words') (st.words || []).forEach(function (w) { var t = String(w.w || '').replace(/^to\s+/i, '').replace(/\s*\(.*?\)\s*/g, ' ').split(' / ')[0].trim(); if (t && t.split(' ').length <= 3) out.push(t); });
    if (st.type === 'learn') (st.cards || []).forEach(function (c) { (String(c.en || '').match(/\*\*(.+?)\*\*/g) || []).forEach(function (m) { out.push(m.replace(/\*\*/g, '')); }); });
  });
  return out;
}
function chatItems(ls, n) {
  var dl = ls.steps.filter(function (s) { return s.type === 'dialogue'; })[0];
  if (!dl || !dl.lines || dl.lines.length < 3) return [];
  var sp = speakers(dl.lines), vocab = lessonVocab(ls), out = [];
  var cand = [];
  dl.lines.forEach(function (l, i) { if (i > 0 && isMe(l.s, sp)) cand.push(i); });
  if (!cand.length) dl.lines.forEach(function (l, i) { if (i > 0) cand.push(i); });
  shuffle(cand).forEach(function (i) {
    if (out.length >= (n || 2)) return;
    var raw = dl.lines[i].t, txt = stripMarks(raw), target = null;
    var chunks = (raw.match(/\*\*(.+?)\*\*/g) || []).map(function (m) { return m.replace(/\*\*/g, ''); }).filter(function (c) { return c.split(' ').length <= 3; });
    if (chunks.length) target = chunks[0];
    if (!target) vocab.some(function (v) { var re = new RegExp('(^|[^A-Za-z’\'])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'i'); if (re.test(txt)) { target = (txt.match(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) || [v])[0]; return true; } });
    if (!target) { var ws = (txt.match(/[A-Za-z’']{4,}/g) || []).filter(function (w) { return !STOPSET[w.toLowerCase()] && !/[’']/.test(w); }); if (ws.length) target = ws[Math.floor(ws.length / 2)]; }
    if (!target) return;
    var at = txt.toLowerCase().indexOf(target.toLowerCase()); if (at < 0) return;
    var wc = target.split(' ').length;
    var names = {}; sp.forEach(function (n) { names[String(n).toLowerCase()] = 1; });
    var words2 = (dl.lines.map(function (l) { return stripMarks(l.t); }).join(' ').match(/[A-Za-z]{4,}/g) || []).filter(function (w) { return !STOPSET[w.toLowerCase()] && !names[w.toLowerCase()] && w === w.toLowerCase(); });
    var dis = [], seen = {}; seen[C.norm(target)] = 1;
    function tryAdd(p) { var k = C.norm(p); if (dis.length < 4 && k && !seen[k] && !names[k] && txt.toLowerCase().indexOf(p.toLowerCase()) < 0 && Math.abs(p.split(' ').length - wc) <= 1) { seen[k] = 1; dis.push(p); } }
    shuffle(vocab).forEach(tryAdd); shuffle(words2).forEach(tryAdd);
    if (dis.length < 2) return;
    var prev = dl.lines[i - 1];
    out.push({ k: 'chat', gen: true, prev: { s: prev.s, t: stripMarks(prev.t), fr: prev.fr }, me: { s: dl.lines[i].s, before: txt.slice(0, at), after: txt.slice(at + target.length), fr: dl.lines[i].fr }, opts: [target].concat(dis), a: 0, why: 'In the conversation: “' + txt + '”' });
  });
  return out;
}

/* ---------------------------------------------------------------- exercise runner (one at a time; shared by lessons, misses round, tests) */
/* list: [{it, id}]  o: {label, photo, gloss, compact, requeue, untilRight, record, test, onAnswer(entry, first, ok), onDone(stats), onPos(i, n)} */
function runner(host, list, o) {
  o = o || {};
  var order = list.map(function (x) { return { it: x.it, id: x.id, tag: x.tag, again: false }; });
  var pos = 0, stats = { first: 0, total: 0, right: 0, misses: [], answered: 0 }, finished = false, advanceT = null;
  var REP = {};
  var root = el('<div class="run' + (o.compact ? ' compact' : '') + '"><div class="run-ex"></div><div class="run-foot"><button class="run-skip">Skip this one</button><span class="run-nav"><button class="run-prev" title="Previous">‹</button><button class="run-next" title="Next">›</button></span><button class="btn primary run-main" disabled>Check</button></div></div>');
  host.appendChild(root);
  var exHost = $('.run-ex', root), mainB = $('.run-main', root), skipB = $('.run-skip', root), prevB = $('.run-prev', root), nextB = $('.run-next', root);
  function cur() { return order[pos]; }
  function paint() {
    var e = cur(); if (!e) return;
    mainB.textContent = e.btnLabel || 'Check'; mainB.disabled = !e.btnEnabled;
    prevB.disabled = pos === 0; nextB.disabled = !e.resolved;
    skipB.style.visibility = e.resolved ? 'hidden' : 'visible';
    if (o.onPos) o.onPos(pos, order.length);
    var lab = $('.pl-chip', e.el); if (lab && !o.compact) lab.textContent = (o.label || 'Practice').toUpperCase() + ' · ' + (o.test ? 'QUESTION ' : 'EXERCISE ') + (pos + 1) + ' OF ' + order.length;
    var cl = $('.run-count', e.el); if (cl) cl.textContent = (pos + 1) + ' / ' + order.length;
  }
  function show(i) {
    clearTimeout(advanceT);
    pos = i; var e = cur();
    if (!e.el) build(e);
    root.__entry = e;
    exHost.innerHTML = ''; exHost.appendChild(e.el);
    paint();
    if (!o.compact && root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var inp = $('input.field, textarea.field', e.el); if (inp && !e.resolved && !o.compact && window.innerWidth > 820) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (x) {} }, 30);
  }
  function next() {
    clearTimeout(advanceT);
    if (pos < order.length - 1) show(pos + 1);
    else if (!finished) { finished = true; done(); }
  }
  function done() {
    exHost.innerHTML = ''; root.querySelector('.run-foot').classList.add('hide');
    if (o.onDone) o.onDone(stats, exHost);
  }
  function resolve(e, first, ok) {
    e.resolved = true; e.btnLabel = 'Next exercise'; e.btnEnabled = true;
    var k = e.it.k, graded = GR[k] && !e.it.gen;
    if (!e.again) {
      stats.answered++;
      if (graded) { stats.total++; if (first) stats.first++; if (o.record !== false && e.id) SE.recordItem(e.id, first); }
      if (ok) stats.right++;
      if (first && (GR[k] || k === 'chat')) SE.addXP(SE.PTS.item[k] || 2);
      else if (ok && !first) SE.addXP(1);
      if (o.onAnswer) o.onAnswer(e, first, ok);
    }
    var needsAgain = !first && (GR[k] || k === 'chat');
    if (o.untilRight) {
      /* repeat until right, but at most 3 more times per question (it also stays in her review deck) */
      var rk = e.id || JSON.stringify(e.it).slice(0, 120); REP[rk] = (REP[rk] || 0) + 1;
      if (!ok && REP[rk] < 3) order.push({ it: e.it, id: e.id, again: true });
    }
    else if (needsAgain && !e.again) {
      stats.misses.push({ it: e.it, id: e.id });
      if (o.requeue !== false) order.push({ it: e.it, id: e.id, again: true });
    }
    paint();
    if (ok) { var delay = e.it.why || e.it.whyFr ? 1700 : 900; advanceT = setTimeout(function () { if (cur() === e) next(); }, delay); }
  }
  function build(e) {
    var it = e.it, k = it.k;
    var head = it.img && SE.imgRec(it.img) && k !== 'describe' ? it.img : (o.photo || null);
    var ins = FR[k] || null;
    var q = k === 'listen' ? FR.listen[0] : k === 'chat' ? FR.chat[0] : (it.q || (ins ? ins[0] : ''));
    var qfr = it.qFr || ((k === 'listen' || k === 'chat') ? ins[1] : (ins && (!it.q || it.q === ins[0]) ? ins[1] : ''));
    var h = '';
    if (!o.compact) h += strip(head || 'x', 'EXERCISE', head ? '' : 'noimg');
    else h += '<div class="run-count eyebrow"></div>' + (e.tag ? '<div class="ex-tag">' + esc(e.tag) + '</div>' : '') + (it.img && SE.imgRec(it.img) && k !== 'describe' && k !== 'pic' ? '<div class="ex-thumb' + SE.illusCls(SE.imgRec(it.img)) + '"><img alt="" src="' + esc(SE.imgRec(it.img).u) + '"></div>' : '');
    h += '<div class="ex-body"><div class="ex-q">' + fmt(q) + '</div>' + frl(qfr) + (it.fr && k !== 'chat' ? frl(it.fr) : '');
    h += '<div class="ex-w"></div><div class="ex-fb"></div></div>';
    var box = el('<div class="ex' + (o.compact ? ' compact' : '') + '">' + h + '</div>');
    e.el = box;
    var w = $('.ex-w', box), fb = $('.ex-fb', box);
    function feedback(kind, title, body, bodyFr) {
      fb.innerHTML = '<div class="fbk ' + kind + '"><div class="fbk-t">' + esc(title) + '</div>' + (body ? '<div class="fbk-b">' + fmt(body) + '</div>' : '') + frf(bodyFr) + '</div>';
      if (o.gloss) SE.applyGloss(fb, o.gloss);
    }
    function whyOf() { return it.why || ''; }
    e.btnLabel = 'Check'; e.btnEnabled = false; e.primary = function () {};
    /* ---- choice kinds: mcq, pic, chat ---- */
    if (k === 'mcq' || k === 'pic' || k === 'chat') {
      if (k === 'chat') {
        var p = it.prev, me = it.me;
        w.innerHTML = '<div class="chat">' +
          '<div class="bub them"><span class="av">' + esc((p.s || 'B').charAt(0)) + '</span><div class="b"><div class="t">' + esc(p.t) + '</div>' + frl(p.fr) + listenLinks(p.t) + '</div></div>' +
          '<div class="bub me"><span class="av">' + esc(initial()) + '</span><div class="b"><div class="t">' + esc(me.before) + '<span class="blank">&nbsp;</span>' + esc(me.after) + '</div>' + frl(me.fr) + '</div></div></div>';
      }
      var idx = shuffle(it.opts.map(function (x, i) { return i; }));
      var picOK = k === 'pic' && it.opts.every(function (x) { return SE.imgRec(x); });
      var long = it.opts.some(function (x) { return String(x).length > 26; });
      var oh = '<div class="opts ' + (picOK ? 'pics' : long ? 'col' : 'row') + '" style="--n:' + idx.length + '">';
      idx.forEach(function (i, n) {
        var lab = k === 'pic' ? (picOK ? '<span class="pic' + SE.illusCls(SE.imgRec(it.opts[i])) + '" style="background-image:url(\'' + esc(SE.imgRec(it.opts[i]).u) + '\')"></span>' : esc((ENG.imgq[it.opts[i]] || it.opts[i]).replace(/_/g, ' '))) : fmt(it.opts[i]);
        oh += '<button class="opt" data-i="' + i + '"><span class="kb">' + (n + 1) + '</span><span class="ol">' + lab + '</span></button>';
      });
      w.insertAdjacentHTML('beforeend', oh + '</div>');
      var sel = null, tries = 0, btns = $$('.opt', w);
      function choose(b) {
        if (e.resolved || b.disabled) return;
        btns.forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); sel = +b.getAttribute('data-i');
        var bl = $('.blank', w); if (bl) { bl.textContent = it.opts[sel]; bl.className = 'blank filled'; }
        e.btnLabel = 'Check'; e.btnEnabled = true; paint();
      }
      btns.forEach(function (b) { b.onclick = function () { choose(b); }; });
      e.pick = function (n) { var b = btns[n]; if (b) choose(b); };
      e.primary = function () {
        if (e.resolved) { next(); return; }
        if (sel == null) return;
        tries++;
        var ok = sel === it.a, b = btns.filter(function (x) { return +x.getAttribute('data-i') === sel; })[0];
        if (e.firstPick == null && !ok) e.firstPick = sel;
        b.classList.remove('sel');
        var bl = $('.blank', w);
        if (ok) {
          b.classList.add('ok'); btns.forEach(function (x) { if (x !== b) x.classList.add('dim'); x.disabled = true; });
          if (bl) bl.className = 'blank ok';
          feedback('ok', pick(PRAISE), whyOf(), it.whyFr);
          resolve(e, tries === 1, true);
        } else {
          b.classList.add('no'); b.disabled = true; sel = null;
          if (bl) bl.className = 'blank no';
          var left = btns.filter(function (x) { return !x.disabled; }).length;
          if (tries >= 2 || left <= 1) {
            btns.forEach(function (x) { x.disabled = true; if (+x.getAttribute('data-i') === it.a) x.classList.add('ok'); });
            if (bl) { bl.textContent = it.opts[it.a]; bl.className = 'blank ok'; }
            var rightTxt = plain(k === 'pic' ? (ENG.imgq[it.opts[it.a]] || it.opts[it.a]) : it.opts[it.a]);
            var firstPick = e.firstPick != null && k !== 'pic' ? plain(it.opts[e.firstPick]) : '';
            if (k === 'chat' && it.me && firstPick) { firstPick = plain(it.me.before + firstPick + it.me.after); rightTxt = plain(it.me.before + it.opts[it.a] + it.me.after); }
            fb.innerHTML = '<div class="fbk no"><div class="fbk-t">Not this time.</div>' + walkthrough(it, firstPick, rightTxt) + '</div>';
            if (o.gloss) SE.applyGloss(fb, o.gloss);
            resolve(e, false, false);
          } else {
            var hn = hintFor(it, plain(it.opts[it.a]));
            fb.innerHTML = '<div class="fbk warn"><div class="fbk-t">Not quite. Look again and try once more.</div>' + (hn ? '<div class="wk-hint"><span class="wk-hl">Hint</span> ' + fmt(hn) + '</div>' : '') + frf('Pas tout à fait. Regarde encore et réessaie.') + '</div>';
            if (o.gloss) SE.applyGloss(fb, o.gloss);
            e.btnLabel = 'Check'; e.btnEnabled = false; paint();
          }
        }
      };
    }
    /* ---- typed kinds: type, fix, listen ---- */
    else if (k === 'type' || k === 'fix' || k === 'listen') {
      var hh = '';
      if (k === 'fix') hh += '<div class="badline nogloss">' + esc(it.s) + '</div>';
      if (k === 'listen') hh += '<div class="listenrow"><button class="btn sm lp">▶ Play</button><button class="btn sm lps">▶ Slower</button></div>';
      hh += '<input class="field big" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (k === 'fix' ? 'Write the sentence correctly…' : 'Type your answer…') + '">';
      w.innerHTML = hh;
      var inp = $('input', w), tries2 = 0;
      if (k === 'listen') { $('.lp', w).onclick = function () { SE.speak(it.say); inp.focus(); }; $('.lps', w).onclick = function () { SE.speak(it.say, { slow: true }); inp.focus(); }; }
      inp.oninput = function () { if (!e.resolved) { e.btnEnabled = !!inp.value.trim(); paint(); } };
      inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); e.primary(); } };
      e.primary = function () {
        if (e.resolved) { next(); return; }
        if (!inp.value.trim()) return;
        var r = it.strict ? strictCheck(inp.value, it.a, it.s) : C.checkAnswer(inp.value, it.a, k === 'fix' ? it.s : null); tries2++;
        var best = plain(C.arr(it.a)[0]);
        if (r.ok) {
          inp.classList.add('ok'); inp.disabled = true;
          feedback('ok', r.typo ? 'Correct! Small spelling slip: “' + plain(r.best) + '”' : pick(PRAISE), whyOf(), it.whyFr);
          resolve(e, tries2 === 1, true);
        } else if (tries2 === 1) {
          inp.classList.add('no'); setTimeout(function () { inp.classList.remove('no'); }, 700);
          var hint = lightHint(inp.value, it), wh = it.walk && it.walk.length ? safeHint(it.walk[0], it, best) : '';
          if (wh) hint = ['**Hint:** ' + wh, ''];
          feedback('warn', r.same ? 'That’s the same sentence. Find the mistake and change it.' : 'Almost! Try once more.', hint[0], hint[1]);
          inp.focus();
        } else {
          inp.classList.add('no'); inp.disabled = true;
          var ca = closestAnswer(inp.value, it.a);
          fb.innerHTML = '<div class="fbk no"><div class="fbk-t">Not this time.</div>' + walkthrough(it, inp.value.trim(), ca ? ca.a : best) + '</div>';
          if (o.gloss) SE.applyGloss(fb, o.gloss);
          resolve(e, false, false);
        }
      };
    }
    /* ---- order: word tiles ---- */
    else if (k === 'order') {
      var target = typeof it.a === 'string' ? it.a : C.arr(it.a)[0];
      var tiles = shuffle((it.words || []).concat(it.extra || []).map(function (x, i) { return { w: x, i: i }; }));
      w.innerHTML = '<div class="tray"><span class="hint">Tap the words in order</span></div><div class="bank">' + tiles.map(function (t) { return '<button class="tile" data-t="' + t.i + '">' + esc(t.w) + '</button>'; }).join('') + '</div>';
      var tray = $('.tray', w), bank = $('.bank', w), chosen = [], tries3 = 0;
      function redraw() {
        tray.innerHTML = chosen.length ? chosen.map(function (t, n) { return '<button class="tile in" data-n="' + n + '">' + esc(t.w) + '</button>'; }).join('') : '<span class="hint">Tap the words in order</span>';
        $$('[data-n]', tray).forEach(function (b) { b.onclick = function () { if (e.resolved) return; var t = chosen.splice(+b.getAttribute('data-n'), 1)[0]; $('[data-t="' + t.i + '"]', bank).classList.remove('used'); redraw(); }; });
        if (!e.resolved) { e.btnEnabled = chosen.length > 0; paint(); }
      }
      $$('[data-t]', bank).forEach(function (b) { b.onclick = function () { if (e.resolved || b.classList.contains('used')) return; b.classList.add('used'); chosen.push(tiles.filter(function (t) { return t.i === +b.getAttribute('data-t'); })[0]); redraw(); }; });
      e.primary = function () {
        if (e.resolved) { next(); return; }
        if (!chosen.length) return;
        tries3++;
        var ok = C.norm(chosen.map(function (t) { return t.w; }).join(' ')) === C.norm(target);
        if (ok) { tray.classList.add('ok'); feedback('ok', pick(PRAISE), whyOf(), it.whyFr); resolve(e, tries3 === 1, true); }
        else if (tries3 === 1) { tray.classList.add('no'); setTimeout(function () { tray.classList.remove('no'); }, 700); feedback('warn', 'Almost! Tap a word to move it back, then try again.', '', 'Presque ! Touche un mot pour le retirer, puis réessaie.'); }
        else { tray.classList.add('no'); fb.innerHTML = '<div class="fbk no"><div class="fbk-t">Not this time.</div>' + walkthrough(it, chosen.map(function (t) { return t.w; }).join(' '), target) + '</div>'; resolve(e, false, false); }
      };
    }
    /* ---- describe the photo (never wrong) ---- */
    else if (k === 'describe') {
      w.innerHTML = (it.img ? SE.ui.photo(it.img, 'descimg') : '') + '<textarea class="field" placeholder="Write 1–2 sentences… There are no wrong answers."></textarea>';
      var ta = $('textarea', w);
      ta.oninput = function () { if (!e.resolved) { e.btnEnabled = SE.words(ta.value) >= 2; paint(); } };
      e.primary = function () {
        if (e.resolved) { next(); return; }
        var text = ta.value.trim(); if (SE.words(text) < 2) return;
        var needs = it.need || [], hits = C.ideasHit(text, needs), all = hits.every(Boolean);
        feedback(all ? 'ok' : 'info', all ? 'Great description!' : 'Good try! Can you add a little more?', whyOf(), it.whyFr);
        var need = el('<div class="need">' + needs.map(function (g, i) { return '<span class="' + (hits[i] ? 'hit' : '') + '">' + (hits[i] ? '✓ ' : '○ ') + esc(g.slice(0, 3).join(' / ')) + '</span>'; }).join('') + '</div>');
        $('.fbk', fb).appendChild(need);
        fb.appendChild(SE.feedbackBlock(text, { model: it.model }));
        if (!e.again) SE.addXP(SE.PTS.describe || 3);
        e.resolved = true; e.btnLabel = 'Next exercise'; e.btnEnabled = true; if (!e.again) stats.answered++; paint();
      };
    } else {
      w.innerHTML = '<p class="muted">This exercise type isn’t supported yet.</p>';
      e.resolved = true; e.btnLabel = 'Next exercise'; e.btnEnabled = true;
      e.primary = function () { next(); };
    }
    if (o.gloss) SE.applyGloss(box, o.gloss);
  }
  mainB.onclick = function () { var e = cur(); if (e && e.primary) e.primary(); };
  skipB.onclick = function () { var e = cur(); if (!e || e.resolved) return; if (o.untilRight) { var sk = e.id || JSON.stringify(e.it).slice(0, 120); REP[sk] = (REP[sk] || 0) + 1; if (REP[sk] < 3) order.push({ it: e.it, id: e.id, again: true }); } e.resolved = true; e.skipped = true; next(); };
  prevB.onclick = function () { if (pos > 0) show(pos - 1); };
  nextB.onclick = function () { var e = cur(); if (e && e.resolved) next(); };
  var handler = function (ev) {
    if (!document.body.contains(root) || finished) return;
    var tag = (ev.target.tagName || '').toUpperCase(), typing = tag === 'INPUT' || tag === 'TEXTAREA';
    var e = cur(); if (!e) return;
    if (!typing && /^[1-9]$/.test(ev.key) && e.pick) { ev.preventDefault(); e.pick(+ev.key - 1); return; }
    if (ev.key === 'Enter' && !typing && !ev.target.closest('button')) { ev.preventDefault(); if (!mainB.disabled) mainB.click(); return; }
    if (ev.key === 'Enter' && !typing && ev.target.closest('button') && ev.target.closest('.opt')) { ev.preventDefault(); if (!mainB.disabled) mainB.click(); return; }
    if (!typing && ev.key === 'ArrowLeft') { prevB.click(); }
    if (!typing && ev.key === 'ArrowRight') { nextB.click(); }
  };
  root._key = handler;
  if (!order.length) { finished = true; setTimeout(done, 0); } else show(0);
  return { root: root, key: handler, stats: stats, next: next };
}
var RUNKEYS = [];
document.addEventListener('keydown', function (ev) {
  RUNKEYS = RUNKEYS.filter(function (r) { return document.body.contains(r.root); });
  var live = RUNKEYS.filter(function (x) { return x.root.offsetParent !== null && !x.root.querySelector('.run-foot.hide'); });
  var act = document.activeElement, r = live.filter(function (x) { return act && x.root.contains(act); })[0];
  if (!r) { var vh = window.innerHeight; r = live.filter(function (x) { var bb = x.root.getBoundingClientRect(); return bb.bottom > 0 && bb.top < vh; })[0] || live[live.length - 1]; }
  if (r) r.key(ev);
});
function run(host, list, o) { var r = runner(host, list, o); RUNKEYS.push(r); return r; }

/* ---------------------------------------------------------------- conventions gym items mixed into a lesson */
function gymItems(ls, n) {
  var pids = (ls.gym || []).filter(function (g) { return SE.LESSONS[g]; });
  if (!pids.length) return [];
  var st = S(), now = Date.now();
  function score(id) { var r = st.items[id]; if (!r) return 2 + Math.random(); if ((r.wrong || 0) > 0 && (r.streak || 0) < 3) return 4 + Math.random(); return (r.due <= now ? 1 : 0) + Math.random(); }
  var all = Object.keys(SE.ITEMS).filter(function (id) { return pids.indexOf(SE.ITEMS[id].lid) >= 0; });
  var ch = all.filter(function (id) { return SE.ITEMS[id].item.k === 'mcq'; }).sort(function (a, b) { return score(b) - score(a); });
  var ty = all.filter(function (id) { var k = SE.ITEMS[id].item.k; return k === 'type' || k === 'fix'; }).sort(function (a, b) { return score(b) - score(a); });
  var half = Math.ceil(n / 2), pickIds = ch.slice(0, half).concat(ty.slice(0, n - half));
  return pickIds.map(function (id) { var L = SE.LESSONS[SE.ITEMS[id].lid]; return { it: SE.ITEMS[id].item, id: id, tag: 'Conventions gym · ' + plain(L.lesson.title) }; });
}

/* ---------------------------------------------------------------- "Check yourself": questions generated from the words and phrases */
function headOf(w) { var h = String(w || '').split(' / ')[0].replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); return h; }
function bareHead(w) { return headOf(w).replace(/^to\s+/i, '').replace(/^(a|an|the)\s+/i, '').trim(); }
function firstSent(t) { t = plain(t || ''); var m = t.match(/^.+?[.!?](\s|$)/); t = (m ? m[0] : t).trim(); return t.length > 120 ? t.slice(0, 117).replace(/\s+\S*$/, '') + '…' : t; }
function escRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function uniqBy(a, f) { var seen = {}; return a.filter(function (x) { var k = f(x); if (!k || seen[k]) return false; seen[k] = 1; return true; }); }
function levelWords(ls) {
  var L = SE.LESSONS[ls.id]; if (!L) return [];
  var out = []; L.level.lessons.forEach(function (l) { if (l === ls) return; l.steps.forEach(function (st) { if (st.type === 'words') out = out.concat(st.words || [], st.everyday || []); }); });
  return out;
}
function pickDis(target, pool, n, key, prefer) {
  key = key || function (x) { return C.norm(x); };
  var tk = key(target), out = [], seen = {}; seen[tk] = 1;
  shuffle((prefer || []).slice()).concat(shuffle(pool.slice())).forEach(function (p) { var k = key(p); if (out.length < n && k && !seen[k]) { seen[k] = 1; out.push(p); } });
  return out;
}
function exGap(w) {
  var ex = plain(w.ex || ''), head = bareHead(w.w); if (!ex || !head || head.split(' ').length > 3) return null;
  var hw = head.split(' ');
  var re = new RegExp('(^|[^A-Za-zÀ-ÿ’\'])(' + hw.map(function (x, i) { return i === 0 ? escRe(x.length > 3 ? x.replace(/e$/, '') : x) + '[a-zà-ÿ]*' : escRe(x); }).join('\\s+') + ')(?![A-Za-zÀ-ÿ])', 'i');
  var m = re.exec(ex); if (!m) return null;
  var start = m.index + m[1].length;
  return { before: ex.slice(0, start), ans: m[2], after: ex.slice(start + m[2].length), head: head };
}
function wordQuiz(ls, words) {
  words = uniqBy(words.filter(function (w) { return w && w.w && w.def; }), function (w) { return C.norm(headOf(w.w)); });
  if (words.length < 3) return [];
  var pool = words.concat(levelWords(ls));
  var terms = uniqBy(pool, function (w) { return C.norm(headOf(w.w)); });
  var items = [], used = {};
  function pickW(filter) { var c = shuffle(words.filter(function (w) { return !used[w.w] && (!filter || filter(w)); })); if (!c.length) c = shuffle(words.filter(function (w) { return !filter || filter(w); })); var w = c[0]; if (w) used[w.w] = 1; return w; }
  function whyW(w) { return '**' + headOf(w.w) + '**: ' + plain(w.def) + (w.ex ? ' Example: *' + plain(w.ex) + '*' : ''); }
  function termOpts(w) { var d = pickDis(headOf(w.w), terms.filter(function (x) { return x !== w; }).map(function (x) { return headOf(x.w); }), 4, null, words.filter(function (x) { return x !== w; }).map(function (x) { return headOf(x.w); })); return d.length >= 2 ? [headOf(w.w)].concat(d) : null; }
  function add(it) { if (it) { it.gen = true; items.push(it); } }
  /* 1. meaning -> word (x3) */
  for (var i = 0; i < 3; i++) { var w = pickW(); if (!w) break; var o = termOpts(w); if (o) add({ k: 'mcq', q: 'Which word or expression means: “' + firstSent(w.def) + '”', opts: o, a: 0, why: whyW(w), whyFr: w.fr ? headOf(w.w) + ' = ' + w.fr : '' }); }
  /* 2. picture -> word (x2) */
  for (i = 0; i < 2; i++) { var wp = pickW(function (x) { return x.img && SE.imgRec(x.img); }); if (!wp) break; var op = termOpts(wp); if (op) add({ k: 'mcq', img: wp.img, q: 'What’s in the picture?', opts: op, a: 0, why: whyW(wp), whyFr: wp.fr ? headOf(wp.w) + ' = ' + wp.fr : '' }); }
  /* 3. word -> meaning */
  var wm = pickW(); if (wm) { var dd = pickDis(firstSent(wm.def), terms.filter(function (x) { return x !== wm; }).map(function (x) { return firstSent(x.def); }), 4); if (dd.length >= 2) add({ k: 'mcq', q: 'What does “' + headOf(wm.w) + '” mean?', opts: [firstSent(wm.def)].concat(dd), a: 0, why: whyW(wm), whyFr: wm.fr ? headOf(wm.w) + ' = ' + wm.fr : '' }); }
  /* 4. French -> English */
  var wf = pickW(function (x) { return x.fr; }); if (wf) { var of = termOpts(wf); if (of) add({ k: 'mcq', q: 'How do you say “' + plain(wf.fr) + '” in English?', opts: of, a: 0, why: whyW(wf), whyFr: '« ' + plain(wf.fr) + ' » = ' + headOf(wf.w) }); }
  /* 5. example sentence with a gap (x2) */
  for (i = 0; i < 2; i++) {
    var wg = pickW(function (x) { return exGap(x); }); if (!wg) break; var g = exGap(wg); if (!g) continue;
    var verb = /verb/i.test(wg.pos || ''), suf = C.norm(g.ans).indexOf(C.norm(g.head)) === 0 ? g.ans.slice(g.head.length) : '';
    var forms = terms.filter(function (x) { return x !== wg && bareHead(x.w).split(' ').length <= 3; }).map(function (x) { var h2 = bareHead(x.w); return suf && verb && /verb/i.test(x.pos || '') ? (/^(ed|d)$/.test(suf) ? h2.replace(/e$/, '') + 'ed' : suf === 'ing' ? h2.replace(/e$/, '') + 'ing' : h2 + suf) : h2; });
    var dg = pickDis(g.ans, forms.filter(function (f) { return g.before.toLowerCase().indexOf(f.toLowerCase()) < 0; }), 4);
    if (dg.length >= 2) add({ k: 'mcq', q: 'Which word fits? ' + g.before + '___' + g.after, opts: [g.ans].concat(dg), a: 0, why: whyW(wg), whyFr: wg.fr ? headOf(wg.w) + ' = ' + wg.fr : '' });
  }
  /* 6. typed: write the word from its meaning (x3) */
  for (i = 0; i < 3; i++) {
    var wt = pickW(function (x) { var h = bareHead(x.w); return h.length >= 3 && h.split(' ').length <= 3 && !/[\/()]/.test(x.w); }); if (!wt) break;
    var h = bareHead(wt.w), full = headOf(wt.w);
    var hint = h.split(' ').map(function (p) { return p.charAt(0) + '…'; }).join(' ');
    add({ k: 'type', q: 'Type the word: ' + firstSent(wt.def) + ' (' + hint + (wt.fr ? ' · ' + plain(wt.fr) : '') + ') ___', a: uniqBy([h, full, full.replace(/^to\s+/i, '')], function (x) { return C.norm(x); }), why: whyW(wt), whyFr: wt.fr ? h + ' = ' + wt.fr : '' });
  }
  return items;
}
function phraseKey(t) { return plain(String(t || '').split(' / ')[0]); }
function levelCards(ls) { var L = SE.LESSONS[ls.id], out = []; if (!L) return out; L.level.lessons.forEach(function (l) { if (l === ls) return; l.steps.forEach(function (st) { if (st.type === 'learn') out = out.concat(st.cards || []); }); }); return out; }
function phraseQuiz(ls, cards) {
  cards = uniqBy((cards || []).filter(function (c) { return c && c.en; }), function (c) { return C.norm(phraseKey(c.en)); });
  if (cards.length < 2) return [];
  var pool = uniqBy(cards.concat(levelCards(ls)), function (c) { return C.norm(phraseKey(c.en)); });
  var items = [], used = {};
  function pickC(f) { var c = shuffle(cards.filter(function (x) { return !used[x.en] && (!f || f(x)); })); if (!c.length) c = shuffle(cards.filter(function (x) { return !f || f(x); })); var x = c[0]; if (x) used[x.en] = 1; return x; }
  function opts(c) { var d = pickDis(phraseKey(c.en), pool.filter(function (x) { return x !== c; }).map(function (x) { return phraseKey(x.en); }), 4, null, cards.filter(function (x) { return x !== c; }).map(function (x) { return phraseKey(x.en); })); return d.length >= 2 ? [phraseKey(c.en)].concat(d) : null; }
  function whyC(c) { return '**' + phraseKey(c.en) + '**' + (c.note ? ': ' + plain(c.note) : '') + (c.ex ? ' Example: *' + plain(c.ex) + '*' : ''); }
  function add(it) { if (it) { it.gen = true; items.push(it); } }
  var i, c, o;
  for (i = 0; i < 3; i++) { c = pickC(function (x) { return x.note && x.note.length > 12; }); if (!c) break; o = opts(c); if (o) add({ k: 'mcq', q: 'Which phrase goes with this? “' + firstSent(c.note) + '”', opts: o, a: 0, why: whyC(c), whyFr: c.fr ? '« ' + plain(c.fr) + ' »' : '' }); }
  for (i = 0; i < 2; i++) { c = pickC(function (x) { return x.fr; }); if (!c) break; o = opts(c); if (o) add({ k: 'mcq', q: 'How do you say “' + plain(c.fr) + '” in English?', opts: o, a: 0, why: whyC(c), whyFr: '« ' + plain(c.fr) + ' » = ' + phraseKey(c.en) }); }
  /* one key word missing */
  var allWords = []; pool.forEach(function (x) { (phraseKey(x.en).match(/[A-Za-z’']{3,}/g) || []).forEach(function (w) { if (!STOPSET[w.toLowerCase()]) allWords.push(w); }); });
  function blankOf(c) { var t = phraseKey(c.en); var ws = (t.match(/[A-Za-z’']{3,}/g) || []).filter(function (w) { return !STOPSET[w.toLowerCase()] && !/[’']/.test(w); }); if (!ws.length) return null; var w = ws[Math.floor(ws.length / 2)]; var at = t.search(new RegExp('(^|[^A-Za-z])' + escRe(w) + '(?![A-Za-z])')); if (at < 0) return null; if (at > 0 || !/^[A-Za-z]/.test(t)) at = t.indexOf(w, at); return { before: t.slice(0, at), w: w, after: t.slice(at + w.length) }; }
  for (i = 0; i < 3; i++) { c = pickC(blankOf); if (!c) break; var b = blankOf(c); var dw = pickDis(b.w, allWords.filter(function (w) { return phraseKey(c.en).toLowerCase().indexOf(w.toLowerCase()) < 0; }), 4); if (dw.length >= 2) add({ k: 'mcq', q: 'Complete the phrase: ' + b.before + '___' + b.after, opts: [b.w].concat(dw), a: 0, why: whyC(c), whyFr: c.fr ? '« ' + plain(c.fr) + ' »' : '' }); }
  for (i = 0; i < 2; i++) { c = pickC(blankOf); if (!c) break; var bt = blankOf(c); add({ k: 'type', q: 'Type the missing word: ' + bt.before + '___' + bt.after + (c.fr ? ' (' + plain(c.fr) + ')' : ''), a: [bt.w], why: whyC(c), whyFr: c.fr ? '« ' + plain(c.fr) + ' »' : '' }); }
  return items;
}
/* ---------------------------------------------------------------- "10 more": endless extra practice for a lesson */
function lessonWordsAll(ls) { var ws = []; ls.steps.forEach(function (st) { if (st.type === 'words') ws = ws.concat(st.words || [], st.everyday || []); }); return ws; }
function moreItems(ls, n) {
  n = n || 10; var out = [], seen = {};
  function push(x) { var k = x.id || JSON.stringify(x.it).slice(0, 160); if (seen[k]) return; seen[k] = 1; out.push(x); }
  gymItems(ls, 4).forEach(push);
  var wq = shuffle(wordQuiz(ls, lessonWordsAll(ls))); wq.slice(0, 2).forEach(function (it) { push({ it: it, id: null }); });
  var cards = []; ls.steps.forEach(function (st) { if (st.type === 'learn') cards = cards.concat(st.cards || []); });
  if (cards.length) shuffle(phraseQuiz(ls, cards)).slice(0, 1).forEach(function (it) { push({ it: it, id: null }); });
  var own = Object.keys(SE.ITEMS).filter(function (id) { return SE.ITEMS[id].lid === ls.id && SE.ITEMS[id].item.k !== 'listen'; });
  own.sort(function (a, b) { return (SE.itemPriority(b) + Math.random() * 2) - (SE.itemPriority(a) + Math.random() * 2); });
  var L = SE.LESSONS[ls.id], lvIds = L ? L.level.lessons.map(function (l) { return l.id; }) : [];
  var due = (SE.dueItems() || []).filter(function (id) { return SE.ITEMS[id] && SE.ITEMS[id].lid !== ls.id && lvIds.indexOf(SE.ITEMS[id].lid) >= 0; }).slice(0, 2);
  due.forEach(function (id) { push({ it: SE.ITEMS[id].item, id: id, tag: 'Recall · ' + plain(SE.LESSONS[SE.ITEMS[id].lid].lesson.title) }); });
  for (var i = 0; i < own.length && out.length < n; i++) push({ it: SE.ITEMS[own[i]].item, id: own[i] });
  return sortEntries(shuffle(out).slice(0, n));
}
function moreButton(host, ls, label, after) {
  var w = el('<div class="more10"><button class="btn more10-b">＋ 10 more questions</button><span class="muted small">Fresh mix: conventions drills, this lesson’s words, and the questions you need most.</span>' + frl('Encore 10 : un mélange des exercices de conventions, des mots de la leçon et des questions à revoir.') + '</div>');
  if (after && after.parentNode) after.parentNode.insertBefore(w, after); else host.appendChild(w);
  $('.more10-b', w).onclick = function () {
    var items = moreItems(ls, 10); if (!items.length) { SE.toast('Nothing more to practice here yet'); return; }
    host.innerHTML = '';
    var h2 = el('<div></div>'); host.appendChild(h2);
    run(h2, items, { label: label || 'More practice', photo: ls.img, gloss: P && P.gloss,
      onDone: function (s2, exH) { if (P) addMisses(s2.misses); exH.innerHTML = '<div class="pl-body"><h2 class="st-h serif">' + s2.right + ' of ' + s2.answered + ' right.</h2><p class="st-sub nogloss">' + (s2.misses.length ? 'The ones you missed come back at the end of the lesson and in your review.' : 'Clean round!') + '</p>' + frl(s2.misses.length ? 'Les questions ratées reviennent à la fin de la leçon et dans ta révision.' : 'Sans faute !') + '</div>'; var nb = P ? stepFoot(exH, { label: P.si >= P.ls.steps.length - 1 ? (P.misses.length ? 'Repeat your misses' : 'Finish lesson') : 'Next step' }) : null; moreButton(exH, ls, label, nb && nb.closest('.pl-foot')); } });
  };
  return w;
}
function checkYourself(b, items, label, frLabel, regen) {
  if (!items.length) return;
  var box = el('<div class="qcheck cy"><div class="cy-h"><span class="eyebrow rose">' + esc(label) + '</span><span class="cy-n">' + items.length + ' questions</span></div>' + frl(frLabel) + '<div class="qhost"></div></div>');
  box._regen = regen || null;
  b.appendChild(box);
  run($('.qhost', box), sortEntries(items.map(function (it) { return { it: it, id: null }; })), { compact: true, gloss: P.gloss, label: label, onDone: function (s, host) { addMisses(s.misses); host.innerHTML = '<div class="fbk ok"><div class="fbk-t">' + s.right + ' of ' + s.answered + ' right.' + (s.misses.length ? ' The ones you missed come back at the end of the lesson.' : ' Nice!') + '</div></div>'; if (box._regen) { var again = el('<button class="btn sm cy-again">↻ Another round</button>'); host.appendChild(again); again.onclick = function () { var nb = box._regen(); if (nb && nb.length) { box.remove(); checkYourself(b, nb, label, frLabel, box._regen); } }; } } });
}

/* ---------------------------------------------------------------- lesson player */
var P = null;
function lessonEyebrow(L) {
  var c = L.course.id;
  if (c === 'path') return 'Level ' + (L.li + 1) + ' · Lesson ' + (L.i + 1);
  if (c === 'school') return 'Grade ' + (L.li + 1) + ' · Unit ' + (L.i + 1);
  return (L.level.title || '') + ' · Lesson ' + (L.i + 1);
}
function stepName(i) {
  if (i === P.ls.steps.length) return 'Repeat your misses';
  return SE.ui.stepName(P.ls, i);
}
function stepLabel(st, i) {
  if (i === P.ls.steps.length) return 'REPEAT YOUR MISSES';
  return ({ words: 'NEW WORDS', learn: 'KEY PHRASES', dialogue: 'SEE IT IN USE', teach: 'LESSON', rule: 'LESSON', culture: 'CULTURE NOTE', quiz: i === P.ls.steps.length - 1 ? 'QUICK CHECK' : 'PRACTICE', convo: 'CONVERSATION', read: 'READING', write: 'WRITING', speak: 'SPEAKING · OPTIONAL' })[st.type] || st.type.toUpperCase();
}
function nSteps() { return P.ls.steps.length + (P.misses.length || P.si === P.ls.steps.length ? 1 : 0); }
/* lesson gloss = its own glossary + every word of the lesson (so highlighted words always have an explanation) */
function lessonGloss(ls) {
  var g = {};
  ls.steps.forEach(function (st) {
    if (st.type !== 'words') return;
    (st.words || []).concat(st.everyday || []).forEach(function (w) {
      var d = { def: firstSent(w.def), fr: w.fr || '' };
      [headOf(w.w), bareHead(w.w)].forEach(function (k) { if (k && k.length > 2 && k.split(' ').length <= 4 && !/[\/…]/.test(k)) g[k] = d; });
    });
  });
  return Object.assign(g, ls.gloss || {});
}
function viewLesson(main, args) {
  var lid = args[0], L = SE.LESSONS[lid];
  if (!L) { SE.go('#/home'); return; }
  var ls = L.lesson, n = ls.steps.length, st = S();
  var prog = st.prog[lid] || { max: 0 };
  var si = args[1] != null && args[1] !== '' ? Math.max(0, Math.min(+args[1] || 0, n - 1)) : Math.min(st.pos[lid] != null ? st.pos[lid] : 0, n - 1);
  P = { lid: lid, L: L, ls: ls, si: si, first: 0, total: 0, misses: [], missIds: {}, gloss: lessonGloss(ls), visited: {} };
  SE.session({ n: 0 });
  document.body.classList.add('focus');
  main.innerHTML = '<div class="pl">' +
    '<div class="pl-bar"><button class="pl-exit">✕&nbsp; Exit lesson</button>' +
    '<div class="pl-prog"><div class="pl-progt"><span class="pl-name">' + esc(ls.title) + '</span><span class="pl-stepl muted"></span></div><div class="pl-segs"></div></div>' +
    '<div class="pl-tools"><button class="pl-fr" id="plfr"></button><span class="pts" id="plpts">+0 pts</span><a class="link pl-to" href="#/test/lesson/' + esc(lid) + '">Test out</a></div></div>' +
    '<div class="pl-grid"><aside class="pl-rail"><div class="eyebrow">' + esc(lessonEyebrow(L)) + '</div><div class="pl-title serif">' + esc(ls.title) + '</div><div class="pl-steps"></div><div class="pl-note">You can jump to any step. Your place is saved.</div></aside>' +
    '<section class="pl-stage"></section><aside class="pl-help"></aside></div></div>';
  $('.pl-exit', main).onclick = function () { SE.go('#/journey/' + encodeURIComponent(L.level.id) + '/' + encodeURIComponent(lid)); };
  $('#plfr', main).onclick = function () { SE.setFrench(!SE.frOn()); };
  SE.emit('change');
  renderHelp();
  renderStep();
}
function saveProg() {
  var st = S(), ls = P.ls, prog = st.prog[P.lid] || { max: 0, n: ls.steps.length };
  if (P.si < ls.steps.length) prog.max = Math.max(prog.max || 0, P.si);
  prog.n = ls.steps.length; prog.t = new Date().toISOString(); if (!prog.start) prog.start = SE.dstr();
  st.prog[P.lid] = prog; if (P.si < ls.steps.length) st.pos[P.lid] = P.si; SE.save();
}
function renderBar() {
  var total = nSteps(), max = (S().prog[P.lid] || {}).max || 0, done = SE.isDone(P.lid);
  $('.pl-stepl').textContent = 'Step ' + (P.si + 1) + ' of ' + total + ' · ' + stepName(P.si);
  var h = '';
  for (var i = 0; i < total; i++) h += '<button class="' + (i === P.si ? 'cur' : (i < P.si || i <= max && done) || P.visited[i] ? 'done' : '') + '" data-step="' + i + '" title="' + esc(stepName(i)) + '"></button>';
  $('.pl-segs').innerHTML = h;
  $$('.pl-segs [data-step]').forEach(function (b) { b.onclick = function () { goStep(+b.getAttribute('data-step')); }; });
  var rail = '';
  for (var j = 0; j < total; j++) {
    var stp = P.ls.steps[j], cur = j === P.si, dn = !cur && (P.visited[j] || j < max || done);
    var opt = stp && stp.type === 'speak';
    rail += '<button class="pl-row' + (cur ? ' cur' : '') + (dn ? ' done' : '') + '" data-step="' + j + '"><span class="pl-mark">' + (dn ? '✓' : (j + 1)) + '</span><span class="pl-rt">' + esc(stepName(j)) + (opt ? '' : '') + '</span><span class="pl-min">' + (stp ? SE.ui.stepMinutes(stp) + ' min' : '') + '</span></button>';
  }
  $('.pl-steps').innerHTML = rail;
  $$('.pl-steps [data-step]').forEach(function (b) { b.onclick = function () { goStep(+b.getAttribute('data-step')); }; });
}
function goStep(i) {
  SE.stopSpeech(); SE.stopRec();
  P.visited[P.si] = true;
  if (i >= P.ls.steps.length) { if (P.misses.length) { P.si = P.ls.steps.length; renderStep(); } else finishLesson(); return; }
  P.si = Math.max(0, i); renderStep(); window.scrollTo(0, 0);
}
function nextStep() { goStep(P.si + 1); }
function renderHelp() {
  var ls = P.ls, help = $('.pl-help'); if (!help) return;
  var cards = [], teach = ls.steps.filter(function (s) { return s.type === 'teach' || s.type === 'rule'; });
  ls.steps.forEach(function (s) { if (s.type === 'learn') (s.cards || []).forEach(function (c) { if (cards.length < 3) cards.push({ en: plain(c.en).split(' / ')[0], use: c.note || '' }); }); });
  if (cards.length < 3) teach.forEach(function (s) { (s.examples || []).forEach(function (x) { if (cards.length < 3) cards.push({ en: plain(x), use: '' }); }); });
  var trap = '';
  ls.steps.forEach(function (s) {
    if (trap || !(s.paras && (s.type === 'teach' || s.type === 'culture' || s.type === 'rule'))) return;
    s.paras.forEach(function (p) { if (trap) return; var en = typeof p === 'string' ? p : p.en; if (/french|français|\btrap\b|francophone/i.test(en || '')) { var sents = plain(en).match(/[^.!?]+[.!?]+/g) || [plain(en)]; var pickS = sents.filter(function (x) { return /french|trap|instead|not “|not "/i.test(x); }).slice(0, 2).join(' ') || sents.slice(0, 2).join(' '); trap = pickS.length > 260 ? pickS.slice(0, 257) + '…' : pickS; } });
  });
  var words = [];
  ls.steps.forEach(function (s) { if (s.type === 'words') (s.words || []).forEach(function (w) { if (words.length < 8) words.push(w); }); });
  var title = (teach[0] && teach[0].title) || ls.title;
  var h = '<div class="card hcard"><div class="eyebrow rose">Why it works</div><div class="hh serif">' + esc(plain(title)) + '</div><div class="pats">' +
    cards.map(function (c) { return '<div class="pat"><b>' + esc(c.en) + '</b>' + (c.use ? '<span>' + esc(plain(c.use)) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
    (trap ? '<div class="trap"><b>French trap:</b> ' + esc(trap) + '</div>' : '') + '</div>';
  if (words.length) h += '<div class="card hcard"><div class="hh2 serif">Words in this lesson</div><div class="wchips">' + words.map(function (w) { return '<button class="wchip" data-say="' + esc(w.w) + '"><b>' + esc(w.w) + '</b>' + frl(w.fr) + '</button>'; }).join('') + '</div></div>';
  help.innerHTML = h;
}
var STEPS = {};
function renderStep() {
  saveProg(); renderBar();
  var stage = $('.pl-stage'); stage.innerHTML = '';
  var si = P.si, st = P.ls.steps[si];
  var card = el('<div class="pl-card"></div>'); stage.appendChild(card);
  if (si === P.ls.steps.length) { stepMisses(card); return; }
  (STEPS[st.type] || STEPS.teach)(st, card, si);
}
/* footer under a non-exercise step: ‹ Back · Next › */
function stepFoot(card, opts) {
  opts = opts || {};
  var f = el('<div class="pl-foot">' + (P.si > 0 ? '<button class="pl-back">‹ Back</button>' : '<span></span>') + '<span class="sp"></span>' + (opts.skip ? '<button class="pl-skipstep">' + esc(opts.skip) + '</button>' : '') + '<button class="btn primary pl-nextb">' + esc(opts.label || 'Next') + ' ›</button></div>');
  card.appendChild(f);
  var b = $('.pl-back', f); if (b) b.onclick = function () { goStep(P.si - 1); };
  var sk = $('.pl-skipstep', f); if (sk) sk.onclick = nextStep;
  $('.pl-nextb', f).onclick = opts.onNext || nextStep;
  return $('.pl-nextb', f);
}
function bodyOf(card, st, si, label, photoKey) {
  card.insertAdjacentHTML('beforeend', strip(photoKey || st.img || P.ls.img || 'x', label, SE.imgRec(photoKey || st.img || P.ls.img) ? 'short' : 'short noimg') + '<div class="pl-body"></div>');
  return $('.pl-body', card);
}
function wordCard(w, wid) {
  var saved = (S().saved || {})['w:' + wid], key = w.img || w.pic, im = key && SE.imgRec(key);
  var pron = w.ipa ? '<div class="wpron nogloss"><span class="wp-ipa">/' + esc(w.ipa) + '/</span>' + (w.say ? '<span class="wp-say">sounds like <b>' + esc(w.say) + '</b></span>' : '') + '</div>' : '';
  return '<div class="wcard' + (im ? ' hasimg' : '') + '">' + (im ? '<div class="wimg' + SE.illusCls(im) + '"><img loading="lazy" alt="" src="' + esc(im.u) + '"></div>' : '') +
    '<div class="wtxt"><div class="wtop"><button class="wterm serif" data-say="' + esc(w.w + '. ' + (w.ex || '')) + '">' + esc(w.w) + '</button>' + (w.pos ? '<span class="wpos">' + esc(w.pos) + '</span>' : '') + (w.reg ? '<span class="wreg">' + esc(w.reg) + '</span>' : '') + '</div>' + pron + frl(w.fr) +
    '<div class="wdef">' + fmt(w.def) + '</div>' + (w.ex ? '<div class="wex">“' + fmt(w.ex) + '”</div>' : '') +
    '<div class="wact"><button class="link" data-say="' + esc(w.w) + '">▶ Listen</button><button class="link wsave" data-c="w:' + esc(wid) + '">' + (saved ? 'Saved ✓' : 'Save') + '</button></div></div></div>';
}
STEPS.words = function (st, card, si) {
  var b = bodyOf(card, st, si, 'New words');
  var ev = st.everyday || [];
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'New words') + '</h2><p class="st-sub nogloss">Tap a word to hear it. These come back in your review cards.</p>' + frl('Touche un mot pour l’entendre. Ils reviennent dans tes cartes de révision.') +
    '<div class="wgrid">' + (st.words || []).map(function (w, i) { return wordCard(w, P.lid + ':' + i); }).join('') + '</div>' +
    (ev.length ? '<div class="evh"><h3 class="st-h2 serif">Everyday words</h3><p class="st-sub nogloss">Common words you’ll hear all the time, in this situation and everywhere else.</p>' + frl('Des mots courants qu’on entend tout le temps, ici et partout.') + '</div><div class="wgrid ev">' + ev.map(function (w, i) { return wordCard(w, P.lid + ':e' + i); }).join('') + '</div>' : '');
  $$('.wsave', b).forEach(function (x) { x.onclick = function () { SE.saveCard(x.getAttribute('data-c')); x.textContent = 'Saved ✓'; }; });
  SE.applyGloss(b, P.gloss);
  checkYourself(b, wordQuiz(P.ls, (st.words || []).concat(ev)), 'Check yourself: the new words', 'Vérifie : les nouveaux mots', function () { return wordQuiz(P.ls, (st.words || []).concat(ev)); });
  stepFoot(card);
};
STEPS.learn = function (st, card, si) {
  var b = bodyOf(card, st, si, 'Key phrases');
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Key phrases') + '</h2><div class="pcards">' + (st.cards || []).map(function (c) {
    return '<div class="pcard2"><button class="pen serif" data-say="' + esc(plain(c.en)) + '">' + fmt(c.en) + '</button>' + frl(c.fr, 'big') + (c.note ? '<div class="pnote">' + fmt(c.note) + '</div>' : '') + (c.ex ? '<div class="pex">' + fmt(c.ex) + '</div>' : '') + '</div>';
  }).join('') + '</div>';
  SE.applyGloss(b, P.gloss);
  checkYourself(b, phraseQuiz(P.ls, st.cards), 'Check yourself: the key phrases', 'Vérifie : les expressions clés', function () { return phraseQuiz(P.ls, st.cards); });
  stepFoot(card);
};
function chatHTML(lines, sp) {
  return '<div class="chat">' + lines.map(function (l, k) {
    var me = isMe(l.s, sp), idx = sp.indexOf(l.s);
    return '<div class="bub ' + (me ? 'me' : 'them') + ' c' + (idx % 4) + '" data-line="' + k + '"><span class="av">' + esc(me ? initial() : (l.s || '?').charAt(0)) + '</span><div class="b"><div class="who">' + esc(l.s || '') + '</div><div class="t">' + fmt(l.t) + '</div>' + frl(l.fr) + (me ? '' : listenLinks(l.t)) + '</div></div>';
  }).join('') + '</div>';
}
STEPS.dialogue = function (st, card, si) {
  var b = bodyOf(card, st, si, 'See it in use');
  var lines = st.lines || [], sp = speakers(lines), pauses = (st.pauses || []).filter(function (x) { return x.at > 0 && x.at < lines.length && x.opts && x.opts.length; }).sort(function (a, c) { return a.at - c.at; });
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Listen & read') + '</h2><p class="st-sub nogloss">' + (pauses.length ? 'Read the conversation. When it stops, guess what comes next.' : 'Read the conversation. The highlighted phrases are the ones to learn.') + '</p>' + frl(pauses.length ? 'Lis la conversation. Quand elle s’arrête, devine la suite.' : 'Lis la conversation. Les expressions surlignées sont celles à apprendre.') +
    '<div class="row-tools"><button class="btn sm playall">▶ Play it all</button>' + (pauses.length ? '<button class="link dl-all">Show the whole conversation</button>' : '') + '</div>' + chatHTML(lines, sp) + '<div class="dl-pause"></div>';
  var token = 0;
  $('.playall', b).onclick = function () {
    var my = ++token; SE.stopSpeech();
    (function stepL(j) { if (my !== token || j >= lines.length) { $$('.bub', b).forEach(function (x) { x.classList.remove('playing'); }); return; } var bub = $('.bub[data-line="' + j + '"]', b); if (bub && bub.classList.contains('hold')) { token++; return; } $$('.bub', b).forEach(function (x) { x.classList.toggle('playing', +x.getAttribute('data-line') === j); }); SE.speak(lines[j].t, { voice: sp.indexOf(lines[j].s), onend: function () { setTimeout(function () { stepL(j + 1); }, 250); } }); })(0);
  };
  SE.applyGloss(b, P.gloss);
  var pi = 0, pHost = $('.dl-pause', b);
  function showUpTo(n) { $$('.bub', b).forEach(function (x) { var k = +x.getAttribute('data-line'); x.classList.toggle('hold', k >= n); if (k < n && !x._shown) { x._shown = true; if (k > 0) x.classList.add('pop'); } }); }
  function nextPause() {
    if (pi >= pauses.length) { showUpTo(lines.length); pHost.innerHTML = ''; return; }
    var pz = pauses[pi], ln = lines[pz.at];
    showUpTo(pz.at);
    var it = { k: 'mcq', q: pz.q || ('What does ' + (isMe(ln.s, sp) ? 'Claire' : ln.s) + ' say next?'), opts: pz.opts.map(function (o) { return String(o).replace(/^\s*\([^)]{1,40}\)\s*/, ''); }), a: pz.a || 0, why: pz.why, whyFr: pz.whyFr, walk: pz.walk, walkFr: pz.walkFr };
    if (/^claire$/i.test(ln.s || '') || /^you$/i.test(ln.s || '')) it.q = pz.q || 'What do you say next?';
    pHost.innerHTML = '';
    var box = el('<div class="try tr-next"><div class="tr-top nogloss"><span class="tr-lab">What comes next?</span><span class="tr-labfr fr-line nogloss">La suite ?</span></div><div class="tr-w"></div></div>');
    pHost.appendChild(box);
    var bub = $('.bub[data-line="' + pz.at + '"]', b); if (bub) bub.after(pHost); 
    run($('.tr-w', box), [{ it: it, id: null }], { compact: true, gloss: P.gloss, label: 'What comes next', onDone: function (s) { addMisses(s.misses); pi++; showUpTo(pz.at + 1); nextPause(); } });
    if (bub) bub.before(pHost);
  }
  if (pauses.length) {
    $('.dl-all', b).onclick = function () { pi = pauses.length; nextPause(); $('.dl-all', b).remove(); };
    nextPause();
  }
  stepFoot(card);
};
function legendIf(strs) { return (strs || []).some(SE.hasChain) ? '<div class="legend"><span><i class="v1">does</i> this word changes (I do · she does · did)</span><span><i class="v2">work</i> this word stays simple</span></div>' : ''; }
/* ---------------------------------------------------------------- inline tries: little questions inside the explanation (v6) */
var TRYLBL = { pick: ['Try it', 'À toi'], spot: ['Spot the mistake', 'Trouve l’erreur'], sort: ['Sort them', 'Trie-les'], reveal: ['Your turn: say it', 'À toi de le dire'], mcq: ['Try it', 'À toi'], type: ['Try it', 'À toi'], fix: ['Fix it', 'Corrige'], order: ['Build it', 'Construis la phrase'] };
function walkSteps(w) { return (w || []).map(function (x) { return typeof x === 'string' ? { en: x } : x; }); }
function tryFb(box, kind, title, it, showWalk) {
  var fb = $('.tr-fb', box);
  fb.innerHTML = '<div class="fbk ' + kind + '"><div class="fbk-t">' + fmt(title) + '</div>' + (it.why ? '<div class="fbk-b">' + fmt(it.why) + '</div>' : '') + frl(it.whyFr) +
    (showWalk && it.walk && it.walk.length ? '<div class="tr-walk"><div class="tr-wh serif">Let’s walk through it</div>' + stepsHTML(walkSteps(it.walk), it.walkFr) + '</div>' : '') + '</div>';
  if (P && P.gloss) SE.applyGloss(fb, P.gloss);
}
function tryMiss(item) { if (P) addMisses([{ it: item, id: null }]); }
function tryShell(it) {
  var lab = TRYLBL[it.k] || TRYLBL.pick;
  return el('<div class="try tr-' + it.k + '"><div class="tr-top nogloss"><span class="tr-lab">' + esc(it.label || lab[0]) + '</span><span class="tr-labfr fr-line nogloss">' + esc(lab[1]) + '</span></div>' + (it.q ? '<div class="tr-q">' + fmt(it.q) + '</div>' + frl(it.qFr) : '') + '<div class="tr-w"></div><div class="tr-fb"></div></div>');
}
function tryPick(it, done) {
  var box = tryShell(it), w = $('.tr-w', box);
  var m = /\[\[(.+?)\]\]/.exec(it.s || ''); if (!m) { done(true); return box; }
  var opts = m[1].split('|').map(function (x) { return x.trim(); }), right = opts[0];
  var before = it.s.slice(0, m.index), after = it.s.slice(m.index + m[0].length);
  w.innerHTML = '<div class="tr-s">' + fmt(before) + '<span class="tr-gap">&nbsp;</span>' + fmt(after) + '</div><div class="tr-opts">' + shuffle(opts.slice()).map(function (o) { return '<button class="tr-chip" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  var tries = 0, gap = $('.tr-gap', w);
  $$('.tr-chip', w).forEach(function (b) {
    b.onclick = function () {
      if (box._done) return; var o = b.getAttribute('data-o'); tries++;
      if (o === right) {
        box._done = true; b.classList.add('ok'); gap.textContent = right; gap.className = 'tr-gap ok';
        $$('.tr-chip', w).forEach(function (x) { x.disabled = true; if (x !== b) x.classList.add('dim'); });
        tryFb(box, 'ok', tries === 1 ? pick(PRAISE) : 'Yes, that’s it.', it, false);
        if (tries === 1) SE.addXP(1); else tryMiss({ k: 'mcq', q: plain(before) + '___' + plain(after), opts: opts, a: 0, why: it.why, whyFr: it.whyFr, walk: it.walk, walkFr: it.walkFr });
        done(tries === 1);
      } else {
        b.classList.add('no'); b.disabled = true; gap.textContent = o; gap.className = 'tr-gap no';
        tryFb(box, 'no', 'Not quite. Try another one.', it, true);
      }
    };
  });
  return box;
}
function tryTokens(s) { return String(s || '').split(/\s+/).filter(Boolean); }
function tokNorm(t) { return C.norm(String(t).replace(/^[“"‘(]+|[”"’).,!?;:]+$/g, '')); }
function trySpot(it, done) {
  var box = tryShell(it), w = $('.tr-w', box);
  var bad = (Array.isArray(it.bad) ? it.bad : [it.bad]).map(tokNorm);
  var toks = tryTokens(it.s), miss = 0;
  w.innerHTML = '<div class="tr-hint muted small">Tap the word that’s wrong.</div>' + frl('Touche le mot qui ne va pas.') + '<div class="tr-s tr-toks">' + toks.map(function (t, i) { return '<button class="tr-tok" data-i="' + i + '">' + esc(t) + '</button>'; }).join(' ') + '</div><div class="tr-fixed"></div>';
  function finish(first) {
    box._done = true;
    $$('.tr-tok', w).forEach(function (x) { x.disabled = true; if (bad.indexOf(tokNorm(x.textContent)) >= 0) x.classList.add('bad'); });
    $('.tr-fixed', w).innerHTML = it.fix ? '<div class="tr-fixline"><span class="tr-arrow">→</span> ' + fmt(it.fix) + ' <button class="link" data-say="' + esc(plain(it.fix)) + '">▶</button></div>' : '';
    if (!first) tryMiss({ k: 'fix', q: 'Fix the mistake.', s: it.s, a: [it.fix].concat(it.fixAlt || []).filter(Boolean), why: it.why, whyFr: it.whyFr, walk: it.walk, walkFr: it.walkFr });
    else SE.addXP(1);
    done(first);
  }
  $$('.tr-tok', w).forEach(function (b) {
    b.onclick = function () {
      if (box._done) return;
      if (bad.indexOf(tokNorm(b.textContent)) >= 0) { b.classList.add('bad'); tryFb(box, 'ok', miss ? 'Found it.' : 'Good eye!', it, false); finish(miss === 0); }
      else { miss++; b.classList.add('nope'); b.disabled = true; if (miss >= 2) { tryFb(box, 'no', 'Here’s the mistake.', it, true); finish(false); } else tryFb(box, 'warn', 'That one’s fine. Look again.', { why: it.hint || '' }, false); }
    };
  });
  return box;
}
function trySort(it, done) {
  var box = tryShell(it), w = $('.tr-w', box), groups = it.groups || [], items = shuffle((it.items || []).map(function (x, i) { return { t: x[0], g: x[1], i: i }; }));
  w.innerHTML = '<div class="tr-hint muted small">Tap a word, then tap where it goes.</div>' + frl('Touche un mot, puis l’endroit où il va.') +
    '<div class="tr-tray">' + items.map(function (x) { return '<button class="tr-chip srt" data-i="' + x.i + '">' + esc(x.t) + '</button>'; }).join('') + '</div>' +
    '<div class="tr-groups" style="--g:' + groups.length + '">' + groups.map(function (g, gi) { return '<button class="tr-group" data-g="' + gi + '"><span class="tr-gh">' + fmt(g) + '</span><span class="tr-gin"></span></button>'; }).join('') + '</div>';
  var sel = null, placed = 0, errs = 0, wrongSet = {};
  $$('.tr-chip.srt', w).forEach(function (c) { c.onclick = function () { if (box._done || c.classList.contains('placed')) return; $$('.tr-chip.srt', w).forEach(function (x) { x.classList.remove('sel'); }); c.classList.add('sel'); sel = c; }; });
  $$('.tr-group', w).forEach(function (g) {
    g.onclick = function () {
      if (box._done || !sel) return;
      var x = it.items[+sel.getAttribute('data-i')], gi = +g.getAttribute('data-g');
      if (x[1] === gi) { sel.classList.remove('sel'); sel.classList.add('placed'); $('.tr-gin', g).appendChild(sel); sel.disabled = true; sel = null; placed++; if (placed === items.length) { box._done = true; tryFb(box, errs ? 'ok' : 'ok', errs ? 'All sorted.' : 'Perfect sort!', it, false); if (!errs) SE.addXP(1); done(!errs); } }
      else { errs++; sel.classList.add('shake'); var s2 = sel; setTimeout(function () { s2.classList.remove('shake'); }, 500); if (!wrongSet[x[0]]) { wrongSet[x[0]] = 1; tryMiss({ k: 'mcq', q: (it.q ? plain(it.q) + ' ' : '') + '“' + x[0] + '” goes in…', opts: groups.map(plain), a: x[1], why: it.why, whyFr: it.whyFr }); } tryFb(box, 'warn', '“' + esc(x[0]) + '” doesn’t go there. Try the other side.', { why: it.hint || '' }, false); }
    };
  });
  return box;
}
function tryReveal(it, done) {
  var box = tryShell(it), w = $('.tr-w', box), answers = [it.a].concat(it.alts || []).filter(Boolean);
  w.innerHTML = '<input class="field tr-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type it (or just say it out loud)…"><div class="tr-row"><button class="btn sm primary tr-check">Check</button><button class="btn sm tr-show">Show me</button></div><div class="tr-ans"></div>';
  var inp = $('.tr-in', w);
  function show(ok, mine) {
    if (box._done) return; box._done = true; inp.disabled = true; $('.tr-row', w).classList.add('hide');
    $('.tr-ans', w).innerHTML = '<div class="tr-model"><span class="tr-ml">' + (ok ? 'Yes! Natural English:' : 'A natural way to say it:') + '</span> <b>' + fmt(it.a) + '</b> <button class="link" data-say="' + esc(plain(it.a)) + '">▶ Listen</button>' + (it.alts && it.alts.length ? '<div class="muted small">Also good: ' + it.alts.map(function (x) { return '“' + esc(plain(x)) + '”'; }).join(' · ') + '</div>' : '') + '</div>';
    tryFb(box, ok ? 'ok' : (mine ? 'no' : 'info'), ok ? pick(PRAISE) : mine ? 'Compare yours with the model.' : 'Say it out loud once or twice.', it, !ok && !!mine);
    if (ok) SE.addXP(2); else tryMiss({ k: 'type', q: it.q || 'Say it in English.', a: answers, why: it.why, whyFr: it.whyFr, walk: it.walk, walkFr: it.walkFr });
    done(ok);
  }
  $('.tr-check', w).onclick = function () { var v = inp.value.trim(); if (!v) { inp.focus(); return; } var r = C.checkAnswer(v, answers); show(r.ok, v); };
  $('.tr-show', w).onclick = function () { show(false, ''); };
  inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); $('.tr-check', w).click(); } };
  return box;
}
function tryRunner(it, done) {
  var box = tryShell({ k: it.k, label: it.label }), w = $('.tr-w', box);
  run(w, [{ it: it, id: null }], { compact: true, gloss: P && P.gloss, label: 'Try it', onDone: function (s, host) { addMisses(s.misses); host.innerHTML = ''; box._done = true; done(s.first > 0); } });
  return box;
}
function renderTry(it, done) {
  if (it.k === 'pick') return tryPick(it, done);
  if (it.k === 'spot') return trySpot(it, done);
  if (it.k === 'sort') return trySort(it, done);
  if (it.k === 'reveal') return tryReveal(it, done);
  return tryRunner(it, done);
}
/* progressive explanation: each paragraph's tries must be answered before the next part appears (or "Show everything") */
function progressive(b, parts, onAllDone) {
  var idx = 0, held = el('<div class="tr-held"><span>Answer the question above to keep going.</span><button class="link tr-showall">Show everything</button></div>');
  parts.forEach(function (p) { p.el.classList.add('seg'); b.appendChild(p.el); });
  b.appendChild(held);
  function update() {
    var gate = -1;
    for (var i = 0; i < parts.length; i++) { if (parts[i].pending > 0 && !parts[i].free) { gate = i; break; } }
    parts.forEach(function (p, i) { p.el.classList.toggle('hold', gate >= 0 && i > gate); });
    held.classList.toggle('hide', gate < 0);
    if (gate >= 0) parts[gate].el.after(held);
    if (gate < 0 && onAllDone && !b._allDone) { b._allDone = true; onAllDone(); }
  }
  $('.tr-showall', held).onclick = function () { parts.forEach(function (p) { p.free = true; }); update(); };
  parts.forEach(function (p, i) {
    function oneDone() { p.pending--; var wasHeld = parts[i + 1] && parts[i + 1].el.classList.contains('hold'); update(); if (wasHeld && parts[i + 1] && !parts[i + 1].el.classList.contains('hold')) { parts[i + 1].el.classList.add('reveal'); } }
    (p.tries || []).forEach(function (it) { $('.para-tries', p.el).appendChild(renderTry(it, oneDone)); });
    if (p.checks && p.checks.length) {
      var qb = el('<div class="try tr-inq"><div class="tr-top nogloss"><span class="tr-lab">Check: did that click?</span><span class="tr-labfr fr-line nogloss">Tu as compris ?</span><span class="tr-cnt muted small">' + p.checks.length + (p.checks.length > 1 ? ' questions' : ' question') + '</span></div><div class="tr-w"></div></div>');
      $('.para-tries', p.el).appendChild(qb);
      run($('.tr-w', qb), sortEntries(p.checks), { compact: true, gloss: P && P.gloss, label: 'Check', onDone: function (s, host) { addMisses(s.misses); host.innerHTML = '<div class="fbk ' + (s.misses.length ? 'info' : 'ok') + '"><div class="fbk-t">' + s.right + ' of ' + s.answered + ' right' + (s.misses.length ? '. Misses come back at the end.' : '. Keep going ↓') + '</div></div>'; oneDone(); } });
    }
  });
  update();
}
STEPS.teach = function (st, card, si) {
  var b = bodyOf(card, st, si, st.type === 'culture' ? 'Culture note' : 'Lesson');
  b.innerHTML = '<h2 class="st-h serif">' + fmt(st.title || 'Lesson') + '</h2>' + (st.diagram ? '<div class="diagram">' + SE.diag(st.diagram) + '</div>' : '');
  var paraList = (st.paras || []).map(function (p) { return typeof p === 'string' ? { en: p } : p; });
  var checks = (st.check || []).map(function (it, ii) { return { it: it, id: P.lid + '#' + si + '.c' + ii }; });
  if (st.q && st.opts) checks.unshift({ it: { k: 'mcq', q: st.q, opts: st.opts, a: st.a, why: st.why }, id: null });
  var byPara = {}, rest = [];
  checks.forEach(function (c) { var pp = c.it.p; if (Number.isInteger(pp) && pp >= 0 && pp < paraList.length) (byPara[pp] = byPara[pp] || []).push(c); else rest.push(c); });
  var parts = paraList.map(function (p, pi) {
    var e = el('<div class="para"><div class="pen2">' + fmt(p.en) + '</div>' + frl(p.fr) + '<div class="para-tries"></div></div>');
    return { el: e, tries: p.try || [], checks: byPara[pi] || [], pending: (p.try || []).length + (byPara[pi] ? 1 : 0) };
  });
  var tail = el('<div class="tail">' + (st.html ? '<div class="para">' + fmt(st.html, true) + '</div>' : '') + frl(st.fr) +
    (st.examples && st.examples.length ? '<div class="exs">' + st.examples.map(function (x) { return '<button class="exl" data-say="' + esc(plain(x)) + '"><span class="pl">▶</span><span>' + fmt(x) + '</span></button>'; }).join('') + '</div>' + legendIf(st.examples) : '') + '</div>');
  parts.push({ el: tail, tries: [], checks: [], pending: 0 });
  var box = null;
  if (rest.length) { box = el('<div class="qcheck"><div class="eyebrow rose">Quick check: can you remember?</div>' + frl('Petite vérification : tu t’en souviens ?') + '<div class="qhost"></div></div>'); parts.push({ el: box, tries: [], checks: [], pending: 0 }); }
  progressive(b, parts);
  SE.applyGloss(b, P.gloss);
  if (box) run($('.qhost', box), sortEntries(rest), { compact: true, gloss: P.gloss, label: 'Quick check', onDone: function (s, host) { addMisses(s.misses); host.innerHTML = '<div class="fbk ok"><div class="fbk-t">Quick check done: ' + s.right + ' of ' + s.answered + ' right.' + (s.misses.length ? ' The ones you missed come back at the end of the lesson.' : '') + '</div></div>'; } });
  stepFoot(card);
};
STEPS.culture = STEPS.teach; STEPS.rule = STEPS.teach;
STEPS.read = function (st, card, si) {
  var b = bodyOf(card, st, si, 'Reading');
  var gl = Object.assign({}, P.gloss, st.gloss || {});
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Reading') + '</h2><p class="st-sub nogloss">Read it first. Tap the underlined words for help.</p>' + frl('Lis d’abord. Touche les mots soulignés pour de l’aide.') +
    '<div class="passage">' + String(st.text || '').split(/\n\s*\n/).map(function (p) { return '<p>' + fmt(p) + '</p>'; }).join('') + '</div>' +
    '<div class="row-tools"><button class="btn sm" data-say="' + esc(plain(st.text)) + '">▶ Listen</button><button class="btn sm ra">Read it aloud (optional)</button></div><div class="rahost"></div>' +
    ((st.items || []).length ? '<div class="qcheck"><div class="eyebrow rose">Questions</div><div class="qhost"></div></div>' : '');
  SE.applyGloss($('.passage', b), gl);
  $('.ra', b).onclick = function () { var h = $('.rahost', b); if (h.firstChild) { h.innerHTML = ''; return; } h.appendChild(SE.readAloud(plain(st.text), P.lid + '#' + si + '.read')); };
  if ((st.items || []).length) run($('.qhost', b), sortEntries(st.items.map(function (it, ii) { return { it: it, id: P.lid + '#' + si + '.' + ii }; })), { compact: true, gloss: gl, label: 'Reading', onAnswer: function (e, first) { if (GR[e.it.k]) { P.total++; if (first) P.first++; } }, onDone: function (s, host) { addMisses(s.misses); host.innerHTML = '<div class="fbk ok"><div class="fbk-t">Reading questions done: ' + s.right + ' of ' + s.answered + ' right.</div></div>'; } });
  stepFoot(card);
};
STEPS.speak = function (st, card, si) {
  var b = bodyOf(card, st, si, 'Speaking · optional');
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Say it out loud') + '</h2><p class="st-sub nogloss">Optional. Say each sentence out loud. If your browser can listen, it shows which words came through.</p>' + frl('Facultatif. Dis chaque phrase à voix haute.') + '<div class="sphost"></div>';
  var host = $('.sphost', b);
  (st.sentences || []).forEach(function (t, i) { host.appendChild(SE.sentenceRow(t, i + 1, P.lid + '#' + si + '.s' + i)); });
  if (st.paragraph) { host.insertAdjacentHTML('beforeend', '<div class="eyebrow" style="margin:22px 0 8px">Read this paragraph aloud</div>'); host.appendChild(SE.readAloud(st.paragraph, P.lid + '#' + si + '.p')); }
  stepFoot(card, { skip: 'Skip speaking' });
};
STEPS.convo = function (st, card, si) {
  var b = bodyOf(card, st, si, 'Conversation');
  var turns = st.turns || [], ti = 0, sp = speakers(turns.filter(function (t) { return !t.choices; }));
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Your turn') + '</h2><p class="st-sub nogloss">' + fmt(st.intro || 'Choose what you would say.') + '</p>' + frl('Choisis la réponse la plus naturelle.') + '<div class="chat cv"></div><div class="cvch"></div>';
  var chat = $('.cv', b), ch = $('.cvch', b), nb = stepFoot(card, { skip: 'Skip' }); nb.disabled = true;
  function bubble(s, t, me) {
    var d = el('<div class="bub ' + (me ? 'me' : 'them') + ' pop"><span class="av">' + esc(me ? initial() : (s || '?').charAt(0)) + '</span><div class="b">' + (me ? '' : '<div class="who">' + esc(s) + '</div>') + '<div class="t">' + fmt(t) + '</div>' + (me ? '' : listenLinks(t)) + '</div></div>');
    chat.appendChild(d); SE.applyGloss(d, P.gloss);
  }
  function advance() {
    while (ti < turns.length && !turns[ti].choices) { bubble(turns[ti].s, turns[ti].t, false); ti++; }
    if (ti >= turns.length) { ch.innerHTML = '<div class="fbk ok"><div class="fbk-t">Conversation complete!</div></div>'; nb.disabled = false; return; }
    var turn = turns[ti], tries = 0, ord = shuffle(turn.choices.map(function (c, k) { return k; }));
    ch.innerHTML = '<div class="opts col">' + ord.map(function (k, n) { return '<button class="opt" data-k="' + k + '"><span class="kb">' + (n + 1) + '</span><span class="ol">' + fmt(turn.choices[k].t) + '</span></button>'; }).join('') + '</div><div class="cvfb"></div>';
    var btns = $$('.opt', ch);
    btns.forEach(function (bt) {
      bt.onclick = function () {
        var c = turn.choices[+bt.getAttribute('data-k')]; tries++;
        if (c.ok) {
          if (tries === 1) SE.addXP(SE.PTS.convo || 2);
          bubble('You', c.t, true); ti++;
          ch.innerHTML = c.fb ? '<div class="fbk ok"><div class="fbk-t">' + fmt(c.fb) + '</div></div>' : '';
          setTimeout(advance, 650);
        } else {
          bt.classList.add('no'); bt.disabled = true;
          $('.cvfb', ch).innerHTML = '<div class="fbk no"><div class="fbk-t">Not quite.</div><div class="fbk-b">' + fmt(c.fb || 'Try another answer.') + '</div></div>';
        }
      };
    });
    ch._pick = function (n) { var bt = btns[n]; if (bt && !bt.disabled) bt.click(); };
  }
  KEYH = function (ev) { var tag = (ev.target.tagName || '').toUpperCase(); if (tag === 'INPUT' || tag === 'TEXTAREA') return; if (/^[1-9]$/.test(ev.key) && ch._pick && document.body.contains(ch)) ch._pick(+ev.key - 1); };
  advance();
};
STEPS.write = function (st, card, si) {
  var b = bodyOf(card, st, si, 'Writing');
  var key = P.lid + '#' + si, min = st.minWords || 20;
  b.innerHTML = '<h2 class="st-h serif">' + esc(st.title || 'Writing') + '</h2><p class="st-sub nogloss">' + fmt(st.prompt) + '</p>' + frl(st.promptFr || 'Ce n’est jamais noté : tu reçois des suggestions, pas une note.') +
    (st.frames && st.frames.length ? '<div class="eyebrow" style="margin-top:14px">Sentence starters</div><div class="frames">' + st.frames.map(function (f) { return '<button data-frame="' + esc(plain(f)) + '">' + fmt(f) + '</button>'; }).join('') + '</div>' : '') +
    '<textarea class="field wta" placeholder="Write here… This is never graded."></textarea><div class="wrow"><span class="wc"></span><span class="sp"></span><button class="btn sm wchk">Get feedback</button></div><div class="wfb"></div>';
  SE.applyGloss(b, P.gloss);
  var ta = $('.wta', b), wc = $('.wc', b), awarded = false;
  ta.value = (S().writes || {})[key] || '';
  function count() { var n = SE.words(ta.value); wc.textContent = n + ' / ' + min + ' words' + (n >= min ? ' ✓' : ''); wc.classList.toggle('ok', n >= min); S().writes[key] = ta.value; SE.save(); }
  ta.oninput = count; count();
  $$('[data-frame]', b).forEach(function (x) { x.onclick = function () { var f = x.getAttribute('data-frame').replace(/…$/, ' '); ta.value = (ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value) + f; ta.focus(); count(); }; });
  $('.wchk', b).onclick = function () {
    var text = ta.value.trim(); if (SE.words(text) < 3) { SE.toast('Write a sentence or two first'); return; }
    var n = SE.words(text), box = $('.wfb', b);
    box.innerHTML = '<div class="fbk ' + (n >= min ? 'ok' : 'info') + '"><div class="fbk-t">' + (n >= min ? 'Great job: ' + n + ' words.' : 'Good start: ' + n + ' words. Try to reach ' + min + '.') + '</div><div class="fbk-b">Read the suggestions, fix what you want, and get feedback again any time.</div></div>';
    box.appendChild(SE.feedbackBlock(text, { checklist: st.checklist, model: st.model }));
    if (!awarded) { awarded = true; SE.addXP(SE.PTS.write || 10); }
  };
  stepFoot(card, { skip: 'Skip for now' });
};
STEPS.quiz = function (st, card, si) {
  var last = si === P.ls.steps.length - 1;
  var items = (st.items || []).map(function (it, ii) { return { it: it, id: P.lid + '#' + si + '.' + ii }; });
  /* less audio: at most 2 listen items */
  var nl = 0; items = items.filter(function (x) { if (x.it.k !== 'listen') return true; nl++; return nl <= 2; });
  /* chat + multiple choice, generated from the dialogue: 2 in the first practice set */
  var firstPractice = P.ls.steps.findIndex(function (s) { return s.type === 'quiz'; }) === si && !last;
  if (firstPractice) {
    var ch = chatItems(P.ls, 2); ch.forEach(function (it, n) { items.splice(Math.min(items.length, 1 + n * 4), 0, { it: it, id: null }); });
    gymItems(P.ls, 4).forEach(function (g, n) { items.splice(Math.min(items.length, 3 + n * 5), 0, g); });
  }
  items = sortEntries(items);
  card.classList.add('ex-card');
  var label = last ? 'Quick check' : 'Practice';
  var host = el('<div></div>'); card.appendChild(host);
  run(host, items, {
    label: label, photo: P.ls.img, gloss: P.gloss,
    onAnswer: function (e, first) { if (GR[e.it.k] && !e.it.gen) { P.total++; if (first) P.first++; } },
    onDone: function (s, exHost) {
      addMisses(s.misses);
      var nextLabel = P.si >= P.ls.steps.length - 1 ? (P.misses.length ? 'Repeat your misses' : 'Finish lesson') : 'Next step';
      exHost.innerHTML = strip(P.ls.img || 'x', label.toUpperCase() + ' · DONE', SE.imgRec(P.ls.img) ? 'short' : 'short noimg') + '<div class="pl-body"><h2 class="st-h serif">' + (s.misses.length ? 'Nice work.' : 'Perfect!') + '</h2><p class="st-sub nogloss">' + s.right + ' of ' + s.answered + ' right' + (s.misses.length ? '. The ones you missed come back at the end of the lesson, and in your review.' : '. Everything right the first time.') + '</p>' + frl(s.misses.length ? 'Les questions ratées reviennent à la fin de la leçon et dans ta révision.' : 'Tout juste du premier coup.') + '</div>';
      var nb = stepFoot(exHost, { label: nextLabel });
      moreButton(exHost, P.ls, label === 'Quick check' ? 'More practice' : 'Practice', nb.closest('.pl-foot'));
    }
  });
};
function addMisses(list) {
  (list || []).forEach(function (m) { var key = m.id || JSON.stringify(m.it).slice(0, 120); if (!P.missIds[key]) { P.missIds[key] = 1; P.misses.push(m); } });
}
function stepMisses(card) {
  card.classList.add('ex-card');
  var host = el('<div></div>'); card.appendChild(host);
  var list = sortEntries(P.misses.map(function (m) { return { it: m.it, id: m.id }; }));
  run(host, list, {
    label: 'Repeat your misses', photo: P.ls.img, gloss: P.gloss, untilRight: true, record: false,
    onDone: function (s, exHost) {
      exHost.innerHTML = '<div class="pl-body"><h2 class="st-h serif">All fixed.</h2><p class="st-sub nogloss">You answered every missed question correctly. Practice makes perfect!</p>' + frl('Tu as corrigé toutes tes erreurs. C’est en forgeant qu’on devient forgeron !') + '</div>';
      P.misses = []; stepFoot(exHost, { label: 'Finish lesson', onNext: finishLesson });
    }
  });
}
function finishLesson() {
  var acc = P.total ? P.first / P.total : 1;
  var r = SE.finishLessonState(P.lid, acc);
  var pl = SE.planList(), idx = pl.indexOf(P.lid), nx = null;
  for (var i = idx + 1; i < pl.length && i >= 1; i++) if (!SE.isDone(pl[i])) { nx = pl[i]; break; }
  if (!nx) { var ord = SE.ORDER[P.L.course.id] || []; nx = ord[ord.indexOf(P.lid) + 1] || null; }
  var stage = $('.pl-stage'); renderBar();
  $$('.pl-segs button').forEach(function (b) { b.className = 'done'; });
  var ses = SE.session() || { n: 0 };
  stage.innerHTML = '<div class="pl-card finish"><div class="fin-stars">' + SE.ui.stars(r.stars) + '</div><div class="eyebrow rose">Lesson complete</div><h1 class="h2">' + esc(P.ls.title) + '</h1>' +
    '<p class="lead">' + esc(P.ls.goal || '') + '</p>' + frl('Leçon terminée. Bravo !') +
    '<div class="fin-stats"><div><b class="serif">' + Math.round(acc * 100) + '%</b><span>right the first time</span></div><div><b class="serif">+' + ses.n + '</b><span>points this lesson</span></div><div><b class="serif">' + SE.state().xp.toLocaleString() + '</b><span>total points</span></div></div>' +
    '<div class="pair">' + (nx ? '<button class="btn primary lg" data-go="#/l/' + esc(nx) + '">Next: ' + esc(SE.LESSONS[nx].lesson.title) + ' ›</button>' : '<button class="btn primary lg" data-go="#/journey">Open the journey</button>') +
    '<button class="btn lg" data-go="#/journey/' + esc(P.L.level.id) + '/' + esc(P.lid) + '">Back to the journey</button></div></div>';
  SE.bindGo(stage);
}
SE.route('l', viewLesson);

/* ---------------------------------------------------------------- test-outs + placement */
function testShell(main, title, sub, eyebrow) {
  document.body.classList.add('focus'); SE.session({ n: 0 });
  main.innerHTML = '<div class="pl test">' +
    '<div class="pl-bar"><button class="pl-exit">✕&nbsp; Exit test</button><div class="pl-prog"><div class="pl-progt"><span class="pl-name">' + esc(title) + '</span><span class="pl-stepl muted"></span></div><div class="pl-segs"></div></div>' +
    '<div class="pl-tools"><button class="pl-fr" id="plfr"></button><span class="pts" id="plpts">+0 pts</span></div></div>' +
    '<div class="pl-grid t"><aside class="pl-rail"><div class="eyebrow">' + esc(eyebrow || 'Test out') + '</div><div class="pl-title serif">' + esc(title) + '</div><p class="pl-note" style="margin-top:12px">' + esc(sub) + '</p>' + frl('Réussis 80 % ou plus et la leçon est marquée « déjà sue » (Knew it). Tu peux toujours l’ouvrir.') + '<div class="t-score"></div></aside><section class="pl-stage"></section><aside class="pl-help"></aside></div></div>';
  $('.pl-exit', main).onclick = function () { history.length > 1 ? history.back() : SE.go('#/journey'); };
  $('#plfr', main).onclick = function () { SE.setFrench(!SE.frOn()); };
  SE.emit('change');
  return $('.pl-stage', main);
}
function testSegs(i, n, results) {
  var s = $('.pl-segs'); if (!s) return;
  var h = ''; for (var k = 0; k < n; k++) h += '<button class="' + (k === i ? 'cur' : results[k] === true ? 'done' : results[k] === false ? 'miss' : '') + '"></button>';
  s.innerHTML = h; $('.pl-stepl').textContent = 'Question ' + Math.min(i + 1, n) + ' of ' + n;
}
function runTest(stage, ids, o) {
  var list = sortEntries(ids.map(function (id) { return { it: SE.ITEMS[id].item, id: id, lid: SE.ITEMS[id].lid }; }));
  var results = [], byLesson = {};
  var card = el('<div class="pl-card ex-card"></div>'); stage.appendChild(card);
  var host = el('<div></div>'); card.appendChild(host);
  run(host, list, {
    label: o.label || 'Test out', test: true, requeue: false, photo: o.photo,
    onPos: function (i, n) { testSegs(i, n, results); },
    onAnswer: function (e, first) {
      var i = list.findIndex(function (x) { return x.id === e.id; }); results[i] = !!first;
      var lid = SE.ITEMS[e.id] ? SE.ITEMS[e.id].lid : null;
      if (lid) { byLesson[lid] = byLesson[lid] || { r: 0, n: 0 }; byLesson[lid].n++; if (first) byLesson[lid].r++; }
      var sc = $('.t-score'); var a = results.filter(function (x) { return x !== undefined; }), r = a.filter(Boolean).length;
      if (sc) sc.innerHTML = '<div class="t-num serif">' + r + ' / ' + a.length + '</div><div class="muted small">right so far · ' + Math.round(r / Math.max(1, a.length) * 100) + '%</div>';
    },
    onDone: function (s, exHost) {
      var pct = Math.round(s.first / Math.max(1, s.total) * 100);
      o.onDone(pct, byLesson, exHost, s);
    }
  });
}
function viewTestLesson(main, args) {
  var lid = args[1], L = SE.LESSONS[lid];
  if (!L) { SE.go('#/journey'); return; }
  var stage = testShell(main, 'Test out · ' + L.lesson.title, 'Answer 10 quick questions from this lesson. Score 80% or more and it’s marked as “Knew it”.', lessonEyebrow(L));
  var ids = SE.lessonTestItems(lid, 10);
  runTest(stage, ids, { photo: L.lesson.img, onDone: function (pct, by, host) {
    var pass = pct >= 80;
    if (pass) SE.markKnew(lid, pct);
    host.innerHTML = resultHTML(pass, pct, pass ? 'You already know “' + L.lesson.title + '”.' : 'Not yet: ' + pct + '%.', pass ? 'It’s marked as Knew it. You can still open it any time.' : 'You need 80% to test out. The lesson will teach you what you missed.', pass ? 'Tu connais déjà cette leçon.' : 'Il faut 80 %. La leçon t’apprendra ce qui manque.') +
      '<div class="pair" style="margin-top:22px"><button class="btn primary lg" data-go="#/journey/' + esc(L.level.id) + '/' + esc(lid) + '">' + (pass ? 'Back to the journey' : 'Open the journey') + '</button><button class="btn lg" data-go="#/l/' + esc(lid) + '">' + (pass ? 'Open the lesson anyway' : 'Start the lesson') + '</button></div></div>';
    SE.bindGo(host);
  } });
}
function findLevel(id) { var f = null; SE.COURSE_ORDER.forEach(function (c) { var co = ENG.courses[c]; if (co) co.levels.forEach(function (lv, i) { if (lv.id === id) f = { lv: lv, li: i, c: co }; }); }); return f; }
function markLevel(lv, by, pct) {
  var marked = [];
  if (pct < 80) return marked;
  lv.lessons.forEach(function (l) { var b = by[l.id]; if (!b || b.r / b.n >= 0.6) { if (!SE.isDone(l.id)) { SE.markKnew(l.id, b ? Math.round(b.r / b.n * 100) : pct); marked.push(l.id); } } });
  return marked;
}
function viewTestLevel(main, args) {
  var f = findLevel(args[1]); if (!f) { SE.go('#/journey'); return; }
  var lv = f.lv, name = (f.c.id === 'school' ? 'Grade ' : f.c.id === 'path' ? 'Level ' : '') + (f.c.id === 'school' || f.c.id === 'path' ? (f.li + 1) + ': ' : '') + lv.title;
  var stage = testShell(main, 'Test out · ' + name, 'Mixed questions from every lesson in this level. Score 80% or more to mark its lessons as “Knew it”.', 'Level test');
  var ids = SE.levelTestItems(lv, 3);
  runTest(stage, ids, { photo: lv.lessons[0] && lv.lessons[0].img, label: 'Level test', onDone: function (pct, by, host) {
    var marked = markLevel(lv, by, pct), pass = pct >= 80;
    host.innerHTML = resultHTML(pass, pct, pass ? 'You tested out of ' + lv.title + '!' : 'Not yet: ' + pct + '%.', pass ? marked.length + ' lessons are marked as Knew it. Lessons where you missed a lot stay open to study.' : 'You need 80% to test out. Open the journey and start where it feels new.', pass ? 'Niveau validé !' : 'Il faut 80 % pour valider le niveau.') +
      '<div class="pair" style="margin-top:22px"><button class="btn primary lg" data-go="#/journey/' + esc(lv.id) + '">Open the journey</button><button class="btn lg" data-go="#/home">Back to Today</button></div></div>';
    SE.bindGo(host);
  } });
}
function resultHTML(pass, pct, title, body, fr) {
  return '<div class="pl-body result ' + (pass ? 'pass' : 'fail') + '">' + SE.ui.ring(pct, 120, '<b>' + pct + '%</b>', { color: pass ? 'var(--lavender)' : 'var(--rose)', th: 10 }) +
    (pass ? '<span class="statetag knew" style="margin-top:14px">Knew it</span>' : '') + '<h2 class="h2" style="margin-top:12px">' + esc(title) + '</h2><p class="lead">' + esc(body) + '</p>' + frl(fr);
}
function viewPlacement(main) {
  var levels = (ENG.courses.path || { levels: [] }).levels.filter(function (lv) { return !lv.adult; });
  var stage = testShell(main, 'Placement check', 'About 12 questions per level, starting at Level 1. Each level you pass (80%+) is marked as Knew it, and the check stops at the first level that feels new.', 'Placement check');
  stage.innerHTML = '<div class="pl-card"><div class="pl-body"><div class="eyebrow rose">Not sure where to start?</div><h2 class="h2" style="margin:8px 0 10px">Find your level.</h2><p class="lead">You’ll answer short sets of questions, one level at a time. As soon as a level feels new, we stop, and that’s where you start. It takes about 12 minutes.</p>' + frl('Tu réponds à de petites séries de questions, niveau par niveau. Dès qu’un niveau est nouveau pour toi, on s’arrête : c’est là que tu commences.') +
    '<div class="pair" style="margin-top:24px"><button class="btn primary lg pstart">Start the check</button><button class="btn lg" data-go="#/journey">Not now</button></div></div></div>';
  SE.bindGo(stage);
  var passed = [];
  $('.pstart', stage).onclick = function () { lvl(0); };
  function lvl(i) {
    if (i >= levels.length) return summary(null);
    var lv = levels[i];
    stage.innerHTML = '';
    var ts = $('.t-score'); if (ts) ts.innerHTML = '';
    $('.pl-name').textContent = 'Placement check · Level ' + (i + 1) + ': ' + lv.title;
    var ids = SE.levelTestItems(lv, 2).slice(0, 12);
    runTest(stage, ids, { label: 'Level ' + (i + 1), photo: lv.lessons[0] && lv.lessons[0].img, onDone: function (pct, by, host) {
      if (pct >= 80) {
        markLevel(lv, by, pct); passed.push({ lv: lv, pct: pct, i: i });
        host.innerHTML = resultHTML(true, pct, 'Level ' + (i + 1) + ' passed!', 'Nice. Let’s try the next level.', 'Niveau réussi ! On passe au suivant.') + '<div class="pair" style="margin-top:22px"><button class="btn primary lg pn">Next level ›</button><button class="btn lg ps">Stop here</button></div></div>';
        $('.pn', host).onclick = function () { lvl(i + 1); };
        $('.ps', host).onclick = function () { summary(levels[i + 1] ? i + 1 : null); };
      } else summary(i, pct);
    } });
  }
  function summary(startAt, pct) {
    var lv = startAt != null ? levels[startAt] : null;
    var sg = $('.pl-segs'); if (sg) sg.innerHTML = ''; var sl = $('.pl-stepl'); if (sl) sl.textContent = 'Done';
    stage.innerHTML = '<div class="pl-card"><div class="pl-body result"><div class="eyebrow rose">Your result</div><h2 class="h2" style="margin:8px 0 10px">' + (lv ? 'Start at Level ' + (startAt + 1) + ': <em>' + esc(lv.title) + '</em>' : 'You passed every level!') + '</h2>' +
      '<p class="lead">' + (passed.length ? 'You tested out of ' + passed.length + ' level' + (passed.length > 1 ? 's' : '') + '. Those lessons are marked as Knew it (lavender) on your journey.' : 'Level 1 is the right place to start. Everything is open, so skip anything you already know.') + '</p>' + frl(lv ? 'Commence au niveau ' + (startAt + 1) + '.' : 'Bravo, tu as tout validé !') +
      '<div class="plc-levels">' + levels.map(function (l, k) { var p = passed.filter(function (x) { return x.i === k; })[0]; return '<div class="plc-l ' + (p ? 'knew' : k === startAt ? 'here' : '') + '">' + SE.ui.ring(p ? 100 : 0, 46, '<b style="font-size:17px">' + (k + 1) + '</b>', { color: 'var(--lavender)', th: 5 }) + '<span>' + esc(l.title) + '</span></div>'; }).join('') + '</div>' +
      '<div class="pair" style="margin-top:22px"><button class="btn primary lg" data-go="#/journey' + (lv ? '/' + esc(lv.id) : '') + '">Open the journey</button><button class="btn lg" data-go="#/home">Back to Today</button></div></div></div>';
    SE.bindGo(stage);
  }
}
SE.route('test', function (main, args) { if (args[0] === 'level') viewTestLevel(main, args); else viewTestLesson(main, args); });
SE.route('placement', viewPlacement);

window.SEPlayer = { runner: run, chatItems: chatItems, sortEntries: sortEntries, walkthrough: walkthrough };
})();
