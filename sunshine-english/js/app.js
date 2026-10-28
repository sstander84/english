/* =========================================================
   Sunshine English: app shell + browse screens (v4 redesign)
   Top bar / bottom tabs / footer, Today, Journey, Library, Progress,
   Settings, Credits. Uses window.SE from js/core.js.
   ========================================================= */
(function () {
'use strict';
var SE = window.SE, esc = SE.esc, $ = SE.$, $$ = SE.$$;
var S = function () { return SE.state(); };
var IX = function () { return SE.index(); };
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var FOCUS = { l: 1, test: 1, placement: 1 };
var NEW_COURSES = { tampa: 1, skills: 1, reading: 1 };

/* ---------------------------------------------------------------- helpers */
function n(x) { return (x || 0).toLocaleString('en-US'); }
function courses() { return ENG.courses; }
function pathLevels() { var st = SE.state(); return ((ENG.courses.path && ENG.courses.path.levels) || []).filter(function (lv) { return !lv.adult || (st && st.settings.adult); }); }
function findLevel(id) {
  var res = null;
  Object.keys(ENG.courses).forEach(function (c) { var co = ENG.courses[c]; (co.levels || []).forEach(function (lv, i) { if (lv.id === id) res = { lv: lv, c: co, li: i }; }); });
  return res;
}
function levelOfLesson(lid) { var L = IX().LESSONS[lid]; return L ? { lv: L.level, c: L.course, li: L.li, i: L.i } : null; }
function lessonImg(ls) {
  if (ls.img && SE.imgRec(ls.img)) return ls.img;
  var k = null;
  (ls.steps || []).some(function (s) { if (s.img && SE.imgRec(s.img)) { k = s.img; return true; } (s.cards || []).concat(s.words || [], s.items || [], s.check || []).some(function (c) { if (c && c.img && SE.imgRec(c.img)) { k = c.img; return true; } }); return !!k; });
  if (!k) { var L = IX().LESSONS[ls.id], cid = L && L.course.id; var dflt = { school: 'fe:notebook_with_decorative_cover', path: 'fe:speech_balloon', gym: 'fe:puzzle_piece', citizen: 'fe:classical_building', career: 'fe:briefcase', tampa: 'fe:palm_tree', skills: 'fe:open_book', reading: 'fe:open_book', adult: 'fe:rose' }[cid]; if (!ls.img || !SE.imgRec(ls.img)) return dflt || ls.img; }
  return k || ls.img;
}
function levelImg(lv) { for (var i = 0; i < lv.lessons.length; i++) { var k = lessonImg(lv.lessons[i]); if (SE.imgRec(k)) return k; } return lv.lessons[0] && lv.lessons[0].img; }
function shortName(ls) {
  if (ls.short) return ls.short;
  var t = SE.plain(ls.title).replace(/[“”"!?.…]/g, '').replace(/^(the|a)\s+/i, '').trim();
  if (t.length <= 18) return t;
  var w = t.split(/\s+/), out = '';
  for (var i = 0; i < w.length; i++) { if ((out + ' ' + w[i]).trim().length > 18 && out) break; out = (out + ' ' + w[i]).trim(); }
  return out.replace(/[,:&]$/, '');
}
function unitWord(c) { return c.id === 'school' ? 'Unit' : 'Lesson'; }
function levelWord(c, li) { return c.id === 'school' ? 'Grade ' + (li + 1) : c.id === 'path' ? 'Level ' + (li + 1) : null; }
function where(lid, sep) {
  var L = IX().LESSONS[lid]; if (!L) return '';
  var lw = levelWord(L.course, L.li);
  return (lw ? lw : L.level.title) + (sep || ' · ') + unitWord(L.course) + ' ' + (L.i + 1);
}
function photo(key, cls, label) { return SE.ui.photo(key, cls, label); }
function plainTitle(s) { return SE.plain(s || ''); }
function practicedDay(d) { var l = (S().log || {})[d]; return !!l && (l.xp > 0 || l.sec >= 60); }
function stepCount(lid) { var L = IX().LESSONS[lid]; return L ? L.lesson.steps.length : 0; }
function curStep(lid) { var st = SE.lessonState(lid); if (st.state === 'finished' || st.state === 'knew') return stepCount(lid); return Math.min(stepCount(lid) - 1, ((S().prog[lid] || {}).max) || 0); }
function minutesLeft(lid) {
  var L = IX().LESSONS[lid]; if (!L) return 0;
  var from = curStep(lid), m = 0;
  L.lesson.steps.forEach(function (st, i) { if (i >= from) m += SE.ui.stepMinutes(st); });
  return m;
}
function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function rankInfo() {
  var xp = S().xp, ri = SE.rankIndex(xp), r = SE.RANKS[ri], nx = SE.RANKS[ri + 1];
  var frac = nx ? (xp - r[0]) / (nx[0] - r[0]) : 1;
  return { xp: xp, i: ri, name: r[1], next: nx, toNext: nx ? nx[0] - xp : 0, frac: Math.max(0, Math.min(1, frac)) };
}
function dueCount() { try { return SE.dueCards(999).length; } catch (e) { return 0; } }
function phraseOfDay() {
  var ps = ENG.phrases || []; if (!ps.length) return null;
  var d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  var i = seed % ps.length; return { p: ps[i], i: i };
}
function stateColor(st) { return st === 'finished' ? 'var(--sage)' : st === 'knew' ? 'var(--lavender)' : st === 'progress' ? 'var(--rose)' : 'var(--notstarted)'; }
function stopSub(lid) {
  var st = SE.lessonState(lid);
  if (st.state === 'finished') return ['Finished', 'var(--sage-text)'];
  if (st.state === 'knew') return ['Tested out · ' + (st.score || 0) + '%', 'var(--lavender)'];
  if (st.state === 'progress') return [st.pct + '% · continue', 'var(--rose-text)'];
  return ['Start · Test out', 'var(--muted)'];
}
function stopTag(lid) {
  var st = SE.lessonState(lid);
  if (st.state === 'finished') return '<span class="stoptag" style="background:var(--sage)">' + '★'.repeat(st.stars || 1) + '</span>';
  if (st.state === 'knew') return '<span class="stoptag" style="background:var(--lavender)">KNEW IT</span>';
  if (st.state === 'progress') return '<span class="stoptag" style="background:var(--rose)">YOU ARE HERE</span>';
  return '';
}
function circle(lid, size, sel, imgKey) {
  var st = SE.lessonState(lid), L = IX().LESSONS[lid], key = imgKey || (L && lessonImg(L.lesson));
  var im = SE.imgRec(key);
  var inner = im ? '<div class="cimg' + (im.illus ? ' illus' : '') + (st.state === 'new' ? ' fade' : '') + '" style="background-image:url(\'' + esc(im.u) + '\')"></div>' : '<span class="cph">' + esc(String(key || '').replace(/^[a-z]+\d?_/, '').replace(/_/g, ' ')) + '</span>';
  return '<div class="circ ' + st.state + (sel ? ' sel' : '') + '" style="width:' + size + 'px;height:' + size + 'px">' + inner + '</div>';
}

/* ---------------------------------------------------------------- shell */
var NAV = [['home', 'Today', '#/home'], ['journey', 'Journey', '#/journey'], ['library', 'Library', '#/library'], ['practice', 'Practice', '#/practice'], ['progress', 'Progress', '#/progress']];
var CUR = 'home';
function navKey(name) {
  if (name === 'home' || !name) return 'home';
  if (name === 'journey') return 'journey';
  if (name === 'library') return 'library';
  if (name === 'practice' || name === 'words') return 'practice';
  if (name === 'progress') return 'progress';
  return '';
}
function renderShell() {
  var s = S(); if (!s) return;
  var due = dueCount(), init = (s.settings.name || 'M').trim().charAt(0).toUpperCase() || 'M', streak = SE.streakNow();
  var tb = $('#topbar'), tabs = $('#tabs'), foot = $('#foot');
  if (tb) tb.innerHTML =
    '<a class="logo" href="#/home"><span class="sun"></span><span class="lt">Sunshine English</span><span class="ls">Sunshine</span></a>' +
    '<nav class="tnav">' + NAV.map(function (x) { return '<a href="' + x[2] + '" class="' + (CUR === x[0] ? 'on' : '') + '">' + x[1] + (x[0] === 'practice' && due ? '<span class="nbadge">' + due + '</span>' : '') + '</a>'; }).join('') + '</nav>' +
    '<div class="tright"><span class="schip"><span class="dot"></span>' + streak + ' day' + (streak === 1 ? '' : 's') + '</span><span class="pchip">' + n(s.xp) + ' pts</span>' +
    '<a class="avatar" href="#/settings" title="' + esc(avatarTitle()) + '">' + esc(init) + cloudDot() + '</a></div>';
  if (tabs) tabs.innerHTML = NAV.map(function (x) { return '<a href="' + x[2] + '" class="' + (CUR === x[0] ? 'on' : '') + '"><span class="ti"></span>' + x[1] + (x[0] === 'practice' && due ? '<span class="tbadge">' + due + '</span>' : '') + '</a>'; }).join('');
  if (foot) foot.innerHTML = '<div class="fin"><span>Sunshine English · made for ' + esc(s.settings.name || 'you') + '</span><span class="fl"><a href="#/settings">Settings</a><a href="#/credits">Photo credits</a><a href="#/progress">Progress</a></span></div>';
}
SE.on('route', function (r) {
  CUR = navKey(r.name);
  document.body.classList.toggle('focus', !!FOCUS[r.name]);
  renderShell();
});
SE.on('change', renderShell);
SE.on('boot', function () { renderShell(); });

/* ---------------------------------------------------------------- Today (2a) */
function weekDots() {
  var d = new Date(), dow = (d.getDay() + 6) % 7, out = [];
  for (var i = 0; i < 7; i++) {
    var dd = new Date(d); dd.setDate(d.getDate() - dow + i);
    var ds = SE.dstr(dd), today = i === dow, done = practicedDay(ds), future = i > dow;
    out.push('<span class="wd"><i class="' + (done ? 'done' : '') + (today ? ' today' : '') + (future ? ' fut' : '') + '"></i><b>' + 'MTWTFSS'.charAt(i) + '</b></span>');
  }
  return out.join('');
}
function calendarHTML(big) {
  var d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  var lead = (first.getDay() + 6) % 7, today = d.getDate(), cells = '';
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(function (w) { cells += '<span class="dow">' + w + '</span>'; });
  for (var i = 0; i < lead; i++) cells += '<span></span>';
  for (var k = 1; k <= days; k++) {
    var ds = SE.dstr(new Date(y, m, k)), min = SE.minutesOn(ds), lg = (S().log || {})[ds];
    if (!min && lg && lg.xp > 0) min = 5;
    var cls = k > today ? 'fut' : min === 0 ? 'h0' : min < 15 ? 'h1' : min < 25 ? 'h2' : 'h3';
    cells += '<span class="cd ' + cls + (k === today ? ' today' : '') + '" title="' + (min ? min + ' min' : '') + '">' + k + '</span>';
  }
  return '<div class="cal' + (big ? ' big' : '') + '">' + cells + '</div>';
}
function monthDays() { var d = new Date(), pre = SE.dstr(d).slice(0, 7); return SE.daysPracticed(pre); }
function planTasks(next) {
  var s = S(), today = SE.dstr(), due = dueCount();
  s.plan = s.plan || {}; var done = s.plan[today] || {};
  var tasks = [];
  var dn = Math.min(due, 20);
  if (due) tasks.push({ id: 'rev', t: 'Review ' + dn + ' card' + (dn > 1 ? 's' : ''), s: Math.max(2, Math.round(dn / 3)) + ' min · words and phrases from past lessons', p: '+' + SE.PTS.review, go: '#/practice/review', min: Math.max(2, Math.round(dn / 3)) });
  else tasks.push({ id: 'rev', t: 'Recall: 10 questions from past lessons', s: '5 min · mixed, the ones you miss come first', p: '+' + SE.PTS.review, go: '#/practice/trouble', min: 5 });
  if (next) {
    var L = IX().LESSONS[next], st = SE.lessonState(next), left = minutesLeft(next);
    tasks.push({ id: 'les', t: (st.state === 'progress' ? 'Finish' : 'Start') + ' “' + plainTitle(L.lesson.title) + '”', s: left + ' min · ' + where(next), p: '+' + SE.PTS.lesson, go: '#/l/' + next, min: left });
  }
  var gymc = ENG.courses.gym;
  if (gymc && gymc.levels.length) tasks.push({ id: 'gym', t: 'Conventions drill: 12 questions', s: '5 min · going to, am / is / are, to, the… the little words', p: '+25', go: '#/practice/gym/drill', min: 5 });
  var odd = new Date().getDate() % 2;
  tasks.push(odd ? { id: 'gap', t: 'Fill the gap: 10 sentences', s: '5 min · choose the missing word', p: '+20', go: '#/practice/gap', min: 5 }
                 : { id: 'chat', t: 'Chat practice: a real situation', s: '5 min · choose what you would say', p: '+20', go: '#/practice/chat', min: 5 });
  tasks.forEach(function (t) { t.done = !!done[t.id]; });
  return tasks;
}
function levelStrip(lv, li, c) {
  c = c || ENG.courses.path;
  var pctv = SE.levelPct(lv);
  var stops = lv.lessons.map(function (ls) {
    var st = SE.lessonState(ls.id), sub = st.state === 'finished' ? '<span class="st-s">' + '★'.repeat(st.stars || 1) + '</span>' : st.state === 'knew' ? '<span class="st-k">KNEW IT</span>' : st.state === 'progress' ? '<span class="st-p">YOU ARE HERE</span>' : '';
    return '<a class="lstop" href="#/journey/' + lv.id + '/' + ls.id + '">' + circle(ls.id, 64) + '<span class="ln">' + esc(shortName(ls)) + '</span><span class="lt">' + sub + '</span></a>';
  }).join('');
  var lw = levelWord(c, li) || lv.title;
  return '<div class="card lstrip"><div class="lshead">' + SE.ui.ring(pctv, 52, '<span class="rp">' + pctv + '%</span>', { color: 'var(--sage)', th: 6 }) +
    '<div class="lst"><div class="eyebrow">' + esc((lw + (c.id === 'path' ? ' of ' + pathLevels().length : '')).toUpperCase()) + (lv.cefr ? ' · ' + esc(lv.cefr) : '') + '</div><div class="h3t">' + esc(lv.title) + '</div></div>' +
    '<a class="btn sm" href="#/test/level/' + lv.id + '">Test out of ' + esc(lw) + '</a><a class="btn sm tintbtn" href="#/journey/' + lv.id + '">Open journey map →</a></div>' +
    '<div class="lstops"><div class="ldash"></div>' + stops + '</div></div>';
}
function troubleHTML(limit) {
  var ids = SE.troubleItems(limit || 3), ITEMS = IX().ITEMS;
  if (!ids.length) return '<div class="tempty">No trouble spots yet. Questions you miss land here, so you can fix them for good.</div>';
  return ids.map(function (id) {
    var it = ITEMS[id].item, r = S().items[id] || {}, bad, good;
    if (it.k === 'fix') { bad = it.s; good = SE.C.arr(it.a)[0]; }
    else if (it.k === 'mcq') { bad = (it.q || '').replace(/\s+/g, ' '); good = it.opts[it.a]; }
    else if (it.k === 'order') { bad = (it.words || []).join(' '); good = it.a; }
    else if (it.k === 'listen') { bad = 'Listen'; good = it.say; }
    else { bad = (it.q || ''); good = SE.C.arr(it.a)[0]; }
    bad = SE.plain(bad); good = SE.plain(good);
    if (bad.length > 34) bad = bad.slice(0, 32) + '…';
    if (good.length > 34) good = good.slice(0, 32) + '…';
    return '<div class="trow"><span class="tb">' + esc(bad) + '</span><span class="ta">→</span><b class="tg">' + esc(good) + '</b><span class="tn">missed ' + (r.wrong || 1) + '×</span></div>';
  }).join('');
}
function viewToday(main) {
  var s = S(), d = new Date(), next = SE.planNext(), L = next ? IX().LESSONS[next] : null;
  var g = SE.goal(), dayxp = Math.min(s.day.d === SE.dstr() ? s.day.xp : 0, 99999), gp = Math.min(100, Math.round(dayxp / g * 100));
  var ri = rankInfo(), name = s.settings.name || 'Morgane', streak = SE.streakNow();
  var nudge;
  if (dayxp >= g) nudge = 'Daily goal done. Anything more today is a bonus.';
  else if (L) nudge = 'You\'re ' + (g - dayxp) + ' points from today\'s goal. Let\'s ' + (SE.lessonState(next).state === 'progress' ? 'finish' : 'start') + ' “' + plainTitle(L.lesson.title) + '”.';
  else nudge = 'You\'re ' + (g - dayxp) + ' points from today\'s goal.';
  var h = '<div class="page today"><div id="safeb">' + safeBanner() + '</div>';
  /* greeting row */
  h += '<div class="greet"><div><div class="eyebrow">' + DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + '</div>' +
    '<h1 class="h1 hi">' + greet() + ', <i>' + esc(name) + '</i>.</h1><p class="nudge">' + esc(nudge) + '</p></div>' +
    '<div class="gtiles"><div class="gt streak"><div class="gtn"><span class="big">' + streak + '</span><span>day streak</span></div><div class="week">' + weekDots() + '</div></div>' +
    '<div class="gt rank"><div class="gtr"><span class="big">' + esc(ri.name) + '</span><span>rank ' + (ri.i + 1) + ' of ' + SE.RANKS.length + '</span></div><div class="bar thick"><i style="width:' + Math.round(ri.frac * 100) + '%"></i></div><div class="gts">' + (ri.next ? n(ri.toNext) + ' pts to <b>' + esc(ri.next[1]) + '</b>' : 'Top rank reached') + '</div></div>' +
    '<div class="gt goalt">' + SE.ui.ring(gp, 68, '<span class="rp">' + gp + '%</span>', { th: 7 }) + '<div class="gts2">Today<br><b>' + dayxp + ' / ' + g + '</b></div></div></div></div>';
  /* phone mini tiles */
  h += '<div class="mtiles"><div><b>' + gp + '%</b><span>daily goal</span></div><div><b>' + n(s.xp) + '</b><span>points</span></div><div><b>' + esc(ri.name) + '</b><div class="bar"><i style="width:' + Math.round(ri.frac * 100) + '%"></i></div></div></div>';
  /* hero + plan */
  h += '<div class="hero2">';
  if (L) {
    var st = SE.lessonState(next), nsteps = L.lesson.steps.length, cs = curStep(next), left = minutesLeft(next);
    var chip = st.state === 'progress' ? 'IN PROGRESS · ' + st.pct + '%' : st.state === 'finished' ? 'FINISHED' : 'UP NEXT';
    h += '<div class="herowrap"><div class="herophoto">' + photo(lessonImg(L.lesson), 'fill', plainTitle(L.lesson.title)) + '<span class="hchip">' + chip + '</span></div>' +
      '<div class="herocard"><div class="eyebrow rose">' + (st.state === 'progress' ? 'CONTINUE · ' : 'NEXT UP · ') + esc(where(next).toUpperCase()) + '</div>' +
      '<h2 class="htitle">' + esc(plainTitle(L.lesson.title)) + '</h2>' + SE.ui.segs(nsteps, cs, st.state === 'progress' ? cs : (st.state === 'new' ? 0 : -1)) +
      '<div class="hmeta"><span>Step ' + Math.min(nsteps, cs + 1) + ' of ' + nsteps + ' · <b>' + esc(SE.ui.stepName(L.lesson, Math.min(nsteps - 1, cs))) + '</b></span><span>about ' + left + ' min left · +' + SE.PTS.lesson + ' pts</span></div>' +
      '<div class="pair hbtns"><a class="btn primary lg" href="#/l/' + next + '">' + (st.state === 'progress' ? 'Continue lesson' : 'Start lesson') + '</a><a class="btn lg" href="#/test/lesson/' + next + '"><span class="dl">Already know it? </span>Test out</a></div></div></div>';
  } else h += '<div class="herowrap"><div class="card pad"><h2 class="h2">Everything is done!</h2><p class="lead">Open the Library for more, or keep your memory fresh in Practice.</p></div></div>';
  var tasks = planTasks(next), tmin = tasks.reduce(function (a, t) { return a + (t.min || 0); }, 0);
  h += '<div class="card plan"><div class="ph2"><h3 class="h3">Today\'s plan</h3><span class="muted small b6">about ' + tmin + ' min</span></div><div class="tasks">' +
    tasks.map(function (t) { return '<div class="task' + (t.done ? ' done' : '') + '" data-task="' + t.id + '"><button class="tick" title="Mark done">' + (t.done ? '✓' : '') + '</button><a class="tt" href="' + t.go + '"><span class="t1">' + esc(t.t) + '</span><span class="t2">' + esc(t.s) + '</span></a><span class="pts">' + t.p + '</span></div>'; }).join('') +
    '</div><div class="goalrow"><span>Daily goal · ' + dayxp + ' of ' + g + ' pts</span><a href="#/settings">Change goal</a></div><div class="bar butter thick"><i style="width:' + gp + '%"></i></div>';
  var due = dueCount();
  h += '<a class="duerow" href="#/practice/' + (due ? 'review' : 'trouble') + '"><span class="dn">' + (due || '0') + '</span><span class="dt">' + (due ? 'review card' + (due > 1 ? 's are' : ' is') + ' due' : 'review cards due') + '<span>' + (due ? 'Words and phrases from past lessons' : 'Nice. Try a recall round instead') + '</span></span><span class="link">Start →</span></a></div></div>';
  /* level strip */
  var lvInfo = L && L.course.id === 'path' ? { lv: L.level, li: L.li, c: L.course } : null;
  if (!lvInfo) { var pl = pathLevels(); for (var i = 0; i < pl.length; i++) { if (!SE.levelDone(pl[i])) { lvInfo = { lv: pl[i], li: i, c: ENG.courses.path }; break; } } if (!lvInfo && pl.length) lvInfo = { lv: pl[0], li: 0, c: ENG.courses.path }; }
  if (L && L.course.id !== 'path') h += levelStrip(L.level, L.li, L.course);
  if (lvInfo) h += levelStrip(lvInfo.lv, lvInfo.li, lvInfo.c);
  /* three cards */
  var pd = phraseOfDay();
  h += '<div class="three"><div class="card calcard"><div class="ch"><h3 class="h3">' + MONTHS[d.getMonth()] + '</h3><span class="muted small b6">' + monthDays() + ' days practiced</span></div>' + calendarHTML() + '</div>';
  if (pd) {
    var saved = !!(s.saved || {})['p:' + pd.i];
    h += '<div class="card potd"><div class="eyebrow rose">Phrase of the day</div><div class="pen">“' + esc(pd.p.en) + '”</div>' +
      (pd.p.fr ? '<div class="pfr fr-line big"><span class="frtag">FR</span>' + esc(pd.p.fr) + '</div>' : '') +
      '<p class="pnote">' + esc(pd.p.note || '') + '</p><div class="pbtns"><button class="wbtn" data-listen="' + esc(SE.plain(pd.p.en)) + '">▶ Listen</button><button class="wbtn rosetxt" data-save="p:' + pd.i + '">' + (saved ? 'Saved ✓' : 'Save to phrasebook') + '</button></div></div>';
  }
  h += '<div class="card trouble"><div class="ch"><h3 class="h3">Trouble spots</h3><span class="muted small b6">French traps</span></div><div class="trows">' + troubleHTML(3) + '</div><a class="link tlink" href="#/practice/trouble">Practice these · 2 min →</a></div></div>';
  h += '</div>';
  main.innerHTML = h; bindSafeBanner(main);
  /* events */
  $$('.task .tick', main).forEach(function (b) {
    b.onclick = function () {
      var row = b.closest('.task'), id = row.getAttribute('data-task'), t = SE.dstr();
      var st = S(); st.plan = st.plan || {}; st.plan[t] = st.plan[t] || {}; st.plan[t][id] = !st.plan[t][id];
      SE.save(); row.classList.toggle('done', !!st.plan[t][id]); b.textContent = st.plan[t][id] ? '✓' : '';
    };
  });
  var lb = $('[data-listen]', main); if (lb) lb.onclick = function () { SE.speak(lb.getAttribute('data-listen')); };
  var sb = $('[data-save]', main); if (sb) sb.onclick = function () { SE.saveCard(sb.getAttribute('data-save')); sb.textContent = 'Saved ✓'; SE.toast('Saved to your phrasebook'); };
}

/* ---------------------------------------------------------------- Journey (3a) */
function levelSelector(c, curId) {
  var lvs = c.id === 'path' ? pathLevels() : c.levels;
  return '<div class="lsel" style="--cols:' + Math.min(9, lvs.length) + '">' + lvs.map(function (lv, i) {
    var p = SE.levelPct(lv), kp = SE.levelKnewPct(lv), sel = lv.id === curId;
    var act, actC = 'var(--muted)';
    if (sel) { act = 'You\'re here'; actC = 'var(--rose-text)'; } else if (p >= 100) act = 'Done'; else if (p > 0) act = p + '%'; else act = 'Test out';
    var label = c.id === 'path' || c.id === 'school' ? String(i + 1) : esc((lv.icon && /[A-Za-z]/.test(lv.id) ? lv.id : lv.id).slice(0, 3));
    return '<a class="lsel-i' + (sel ? ' sel' : '') + '" href="#/journey/' + lv.id + '">' + SE.ui.ring(p, 60, '<b class="rn">' + label + '</b>', { lav: kp, th: 6 }) +
      '<span class="lt2">' + esc(lv.title.replace(/^Grade \d+:\s*/, '')) + '</span><span class="la" style="color:' + actC + '">' + esc(lv.cefr || '') + (lv.cefr ? ' · ' : '') + act + '</span></a>';
  }).join('') + '</div>';
}
function stepList(lid) {
  var L = IX().LESSONS[lid], st = SE.lessonState(lid), cs = curStep(lid);
  var names = L.lesson.steps.map(function (s, i) { return SE.ui.stepName(L.lesson, i); }), cnt = {}, seen = {};
  names.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; });
  names = names.map(function (x) { if (cnt[x] < 2) return x; seen[x] = (seen[x] || 0) + 1; return x + ' ' + seen[x]; });
  return L.lesson.steps.map(function (s, i) {
    var done = st.state === 'finished' || st.state === 'knew' || i < cs, cur = st.state === 'progress' && i === cs;
    var mark = done ? '✓' : String(i + 1);
    return '<a class="srow' + (cur ? ' cur' : '') + '" href="#/l/' + lid + '/' + i + '"><span class="sc ' + (done ? 'done' : cur ? 'cur' : '') + '">' + mark + '</span><span class="sn">' + esc(SE.ui.stepName(L.lesson, i)) + '</span><span class="sm">' + SE.ui.stepMinutes(s) + ' min</span></a>';
  }).join('');
}
function detailPanel(lid) {
  var L = IX().LESSONS[lid]; if (!L) return '';
  var st = SE.lessonState(lid), ls = L.lesson, left = minutesLeft(lid), cs = curStep(lid);
  var chip = st.state === 'progress' ? ['IN PROGRESS · ' + st.pct + '%', 'var(--rose)'] : st.state === 'finished' ? ['FINISHED · ' + '★'.repeat(st.stars || 1), 'var(--sage)'] : st.state === 'knew' ? ['KNEW IT · ' + (st.score || 0) + '%', 'var(--lavender)'] : ['NOT STARTED', 'var(--muted)'];
  var btns;
  if (st.state === 'finished') btns = ['<a class="btn primary" href="#/l/' + lid + '/0">Review lesson</a>', '<a class="btn" href="#/l/' + lid + '/0">Redo for 3 stars</a>'];
  else if (st.state === 'knew') btns = ['<a class="btn primary" href="#/l/' + lid + '/0">Open anyway</a>', '<a class="btn" href="#/test/lesson/' + lid + '">Retake the test</a>'];
  else if (st.state === 'progress') btns = ['<a class="btn primary" href="#/l/' + lid + '">Continue · step ' + (cs + 1) + '</a>', '<a class="btn" href="#/test/lesson/' + lid + '">Test out (5 min)</a>'];
  else btns = ['<a class="btn primary" href="#/l/' + lid + '">Start lesson</a>', '<a class="btn" href="#/test/lesson/' + lid + '">Test out (5 min)</a>'];
  var note = st.state === 'progress' ? 'About ' + left + ' minutes left. Your place is saved.' : st.state === 'finished' ? 'Finished. Review it any time; missed questions come back in Practice.' : st.state === 'knew' ? 'You tested out of this one. Open it any time to brush up.' : 'About ' + left + ' minutes. Already know it? Pass a short test and skip it.';
  return '<div class="card dpanel"><div class="dphoto">' + photo(lessonImg(ls), 'fill', plainTitle(ls.title)) + '<span class="dchip" style="background:' + chip[1] + '">' + chip[0] + '</span></div>' +
    '<div class="dbody"><div class="eyebrow">' + esc(where(lid).toUpperCase()) + '</div><h3 class="dtitle">' + esc(plainTitle(ls.title)) + '</h3>' +
    (ls.goal ? '<p class="dgoal">' + esc(ls.goal) + '</p>' : '') + (ls.goalFr ? SE.frLine(ls.goalFr) : '') +
    '<div class="dsteps">' + stepList(lid) + '</div><div class="dnote">' + esc(note) + '</div><div class="pair dbtns">' + btns.join('') + '</div></div></div>';
}
function serpentine(lv, selLid) {
  var ls = lv.lessons, rows = [];
  for (var i = 0; i < ls.length; i += 4) rows.push(ls.slice(i, i + 4).map(function (l, k) { return { l: l, idx: i + k }; }));
  var h = '<div class="serp">';
  for (var r = 0; r < rows.length; r += 2) {
    var pair = rows.slice(r, r + 2), isTail = pair.length === 2;
    var mask = '';
    if (isTail && pair[1].length < 4) { var k = pair[1].length; mask = '<div class="smask" style="width:calc(100% - 65px - ' + (k - 1) + ' * (100% - 130px) / 3)"></div>'; }
    h += '<div class="spair">' + (isTail ? '<div class="strack"></div>' + mask : '<div class="strack line"></div>');
    pair.forEach(function (row, k) {
      h += '<div class="srowx' + (k === 1 ? ' rev' : '') + (row.length < 4 ? ' short' : '') + '">' + row.map(function (x) {
        var sub = stopSub(x.l.id), sel = x.l.id === selLid;
        return '<a class="stop" data-pick="' + x.l.id + '" href="#/journey/' + lv.id + '/' + x.l.id + '">' + '<div class="stopc">' + circle(x.l.id, 104, sel) + stopTag(x.l.id) + '</div>' +
          '<div class="snum">' + (unitWord(findLevel(lv.id).c) + ' ' + (x.idx + 1)).toUpperCase() + '</div><div class="stitle">' + esc(plainTitle(x.l.title)) + '</div><div class="ssub" style="color:' + sub[1] + '">' + esc(sub[0]) + '</div></a>';
      }).join('') + '</div>';
    });
    h += '</div>';
  }
  return h + '</div>';
}
function zigzag(lv, selLid) {
  return '<div class="zig"><div class="zline"></div>' + lv.lessons.map(function (l, i) {
    var sub = stopSub(l.id);
    return '<a class="zstop' + (i % 2 ? ' r' : '') + '" href="#/journey/' + lv.id + '/' + l.id + '">' + circle(l.id, 66, l.id === selLid) + '<span class="zt"><span class="snum">' + (unitWord(findLevel(lv.id).c) + ' ' + (i + 1)).toUpperCase() + '</span><b>' + esc(plainTitle(l.title)) + '</b><span style="color:' + sub[1] + '">' + esc(sub[0]) + '</span></span></a>';
  }).join('') + '</div>';
}
function sideTrails(lv) {
  var mods = [];
  ['tampa', 'skills', 'reading'].forEach(function (c) { var co = ENG.courses[c]; if (co && SE.courseVisible(c)) co.levels.forEach(function (l) { mods.push({ l: l, c: co }); }); });
  if (!mods.length) ['career', 'school'].forEach(function (c) { var co = ENG.courses[c]; if (co) co.levels.forEach(function (l) { mods.push({ l: l, c: co }); }); });
  var li = pathLevels().indexOf(lv); if (li < 0) li = 0;
  var picked = [];
  for (var i = 0; i < mods.length && picked.length < 3; i++) picked.push(mods[(li * 3 + i) % mods.length]);
  return picked.map(function (m) {
    var p = SE.levelPct(m.l);
    return '<a class="card trail" href="#/journey/' + m.l.id + '"><div class="tph">' + photo(levelImg(m.l), 'fill', m.l.title) + '</div><div><div class="eyebrow">' + esc((m.c.group || m.c.title).toUpperCase()) + '</div><div class="tt3">' + esc(m.l.title) + '</div><div class="link sm2">' + m.l.lessons.length + ' lesson' + (m.l.lessons.length > 1 ? 's' : '') + ' · ' + (p ? 'Continue' : 'Start') + '</div></div></a>';
  }).join('');
}
/* ---------------------------------------------------------------- Love & relationships track (part of the journey) */
var REL_LESSONS = ['L1-2', 'L3-6', 'TD-1', 'L5-5', 'L5-6', 'FA-1', 'G8-3'];
function relLessonCards() {
  return REL_LESSONS.filter(function (id) { return IX().LESSONS[id] && SE.lidVisible(id); }).map(function (id) {
    var L = IX().LESSONS[id], st = SE.lessonState(id);
    return '<a class="card trail" href="#/journey/' + L.level.id + '/' + id + '"><div class="tph">' + photo(lessonImg(L.lesson), 'fill', L.lesson.title) + '</div><div><div class="eyebrow">' + esc(where(id).toUpperCase()) + '</div><div class="tt3">' + esc(plainTitle(L.lesson.title)) + '</div><div class="link sm2">' + (st.state === 'finished' || st.state === 'knew' ? 'Done ✓' : st.state === 'progress' ? 'Continue' : 'Start') + '</div></div></a>';
  }).join('');
}
function relTrack() {
  var ad = ENG.courses.adult; if (!ad || !SE.courseVisible('adult') || !ad.levels.length) return '';
  var lessons = [].concat.apply([], ad.levels.map(function (l) { return l.lessons; })), done = lessons.filter(function (l) { return SE.isDone(l.id); }).length;
  return '<div class="reltrack"><div class="trailh"><h3 class="h3">Love &amp; relationships</h3><span class="muted">Part of your journey: dating, flirting, initiating, the real words, consent and the French traps. ' + done + ' of ' + lessons.length + ' done. These lessons also come up in your plan every few lessons.</span></div>' +
    levelSelector(ad, null) + '</div>';
}
function viewJourney(main, args) {
  var lvid = args[0], selLid = args[1];
  var f = lvid ? findLevel(lvid) : null;
  if (!f) {
    var next = SE.planNext(), L = next && IX().LESSONS[next];
    if (L && L.course.id === 'path') f = { lv: L.level, c: L.course, li: L.li };
    else { var pl = pathLevels(), k = 0; for (var i = 0; i < pl.length; i++) if (!SE.levelDone(pl[i])) { k = i; break; } f = pl.length ? { lv: pl[k], c: ENG.courses.path, li: k } : null; }
  }
  if (!f) { main.innerHTML = '<div class="page"><h1 class="h1">No lessons yet</h1></div>'; return; }
  var lv = f.lv, c = f.c, li = f.li, isPath = c.id === 'path';
  if (!selLid || !lv.lessons.some(function (l) { return l.id === selLid; })) {
    selLid = null;
    for (var j = 0; j < lv.lessons.length; j++) if (SE.lessonState(lv.lessons[j].id).state === 'progress') { selLid = lv.lessons[j].id; break; }
    if (!selLid) for (var j2 = 0; j2 < lv.lessons.length; j2++) if (!SE.isDone(lv.lessons[j2].id)) { selLid = lv.lessons[j2].id; break; }
    if (!selLid) selLid = lv.lessons[0].id;
  }
  var doneN = lv.lessons.filter(function (l) { return SE.isDone(l.id); }).length, total = lv.lessons.length;
  var lw = levelWord(c, li);
  var h = '<div class="page journey">';
  if (isPath) {
    var tot = pathLevels().reduce(function (a, l) { return a + l.lessons.length; }, 0);
    h += '<div class="jhead"><div class="jh"><div class="eyebrow">Your journey · A2 → C1 · ' + tot + ' lessons</div><h1 class="h1">' + (['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'][pathLevels().length] || pathLevels().length) + ' levels, <i>one path.</i></h1><p class="lead jl">Open any lesson, in any order. If you already know something, pass a short test and skip it.</p></div>' +
      '<div class="place"><div><b>Not sure where to start?</b><span>The placement check takes about 12 minutes and marks lessons you already know.</span></div><a class="btn primary sm" href="#/placement">Take the check</a></div></div>';
  } else {
    h += '<div class="jhead"><div class="jh"><a class="link back" href="' + (c.id === 'adult' ? '#/journey' : '#/library') + '">← ' + (c.id === 'adult' ? 'Journey' : 'Library') + '</a><div class="eyebrow" style="margin-top:12px">' + esc(c.id === 'adult' ? 'YOUR JOURNEY · LOVE & RELATIONSHIPS' : (c.group || c.title).toUpperCase()) + '</div><h1 class="h1">' + esc(c.title) + '</h1><p class="lead jl">' + esc(c.blurb || '') + '</p></div></div>';
  }
  if (c.levels.length > 1) h += levelSelector(c, lv.id);
  h += '<div class="jgrid"><div class="card lg pathcard"><div class="pch"><div><div class="eyebrow rose">' + esc(((lw || lv.title) + (lv.cefr ? ' · ' + lv.cefr : '') + ' · ' + doneN + ' of ' + total + ' done').toUpperCase()) + '</div><h2 class="ptitle">' + esc(lv.title.replace(/^Grade \d+:\s*/, '')) + '</h2></div>' +
    '<a class="btn sm" href="#/test/level/' + lv.id + '">Test out of ' + esc(lw || 'this ' + (c.unit || 'level').toLowerCase()) + '</a></div>' +
    '<div class="legend2"><span><i style="background:var(--sage)"></i>Finished</span><span><i style="background:var(--lavender)"></i>Knew it (tested out)</span><span><i style="background:var(--rose)"></i>In progress</span><span><i class="dash"></i>Not started</span></div>' +
    serpentine(lv, selLid) + zigzag(lv, selLid);
  var nx = c.levels[li + 1];
  if (nx) h += '<div class="nextlv"><span class="ndash"></span><div><div class="eyebrow">Next ' + esc((c.unit || 'level').toLowerCase()) + '</div><b>' + esc((levelWord(c, li + 1) ? levelWord(c, li + 1) + ' · ' : '') + nx.title.replace(/^Grade \d+:\s*/, '')) + '</b></div><a class="link" href="#/test/level/' + nx.id + '">Skip ahead with a test-out →</a></div>';
  h += '</div><div class="dcol">' + detailPanel(selLid) + '</div></div>';
  if (lv.id === 'LOVE' || c.id === 'adult') h += '<div class="trailh"><h3 class="h3">More relationship lessons on your path</h3><span class="muted">Family, friends, plans, teasing and personalities: the everyday side of relationships</span><a class="link" href="#/journey">Back to the journey →</a></div><div class="trails">' + relLessonCards() + '</div>';
  else h += '<div class="trailh"><h3 class="h3">Side trails for this ' + (isPath ? 'level' : (c.unit || 'course').toLowerCase()) + '</h3><span class="muted">Short modules that pair well with what you\'re learning</span><a class="link" href="#/library">Open the library →</a></div><div class="trails">' + sideTrails(lv) + '</div>';
  /* phone floating card */
  var Ls = IX().LESSONS[selLid], sst = SE.lessonState(selLid);
  h += '<div class="jfloat"><div><div class="eyebrow">' + esc(where(selLid).toUpperCase()) + '</div><b>' + esc(plainTitle(Ls.lesson.title)) + '</b></div><a class="btn primary sm" href="#/l/' + selLid + '">' + (sst.state === 'progress' ? 'Continue' : sst.state === 'new' ? 'Start' : 'Open') + '</a></div>';
  h += '</div>';
  main.innerHTML = h;
  /* keep the scroll position when picking another lesson */
  $$('[data-pick]', main).forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault(); var lid = a.getAttribute('data-pick');
      history.replaceState(null, '', '#/journey/' + lv.id + '/' + lid);
      $$('.circ.sel', main).forEach(function (x) { x.classList.remove('sel'); });
      var c2 = a.querySelector('.circ'); if (c2) c2.classList.add('sel');
      $('.dcol', main).innerHTML = detailPanel(lid);
    });
  });
}

/* ---------------------------------------------------------------- Library (3c) */
var LIB_FILTER = 'all';
function libGroups() {
  var g = [], cs = ENG.courses;
  function cards(cid, eyebrowFn) { var c = cs[cid]; if (!c || !SE.courseVisible(cid)) return []; return c.levels.map(function (lv, i) { return { lv: lv, c: c, li: i, eyebrow: eyebrowFn(lv, i, c), isNew: !!NEW_COURSES[cid] }; }); }
  g.push({ id: 'core', name: 'Core path', sub: 'The main course, A2 to C1', items: cards('path', function (lv, i) { return 'Level ' + (i + 1) + (lv.cefr ? ' · ' + lv.cefr : ''); }) });
  g.push({ id: 'tampa', name: 'Life in Tampa', sub: 'New · real situations, short modules', items: cards('tampa', function () { return 'Life in Tampa'; }) });
  var skill = [];
  if (cs.school && cs.school.levels.length) skill.push({ grammar: true, c: cs.school, isNew: true, eyebrow: 'Skill studio', lv: { id: cs.school.levels[0].id, title: 'Grammar foundations', blurb: cs.school.blurb, lessons: [].concat.apply([], cs.school.levels.map(function (l) { return l.lessons; })) } });
  if (cs.gym && cs.gym.levels.length) skill.push({ gym: true, c: cs.gym, isNew: true, eyebrow: 'Skill studio', img: 'fe:flexed_biceps', lv: { id: cs.gym.levels[0].id, title: 'Conventions gym', blurb: cs.gym.blurb, lessons: [].concat.apply([], cs.gym.levels.map(function (l) { return l.lessons; })) } });
  skill = skill.concat(cards('skills', function () { return 'Skill studio'; }));
  g.push({ id: 'skill', name: 'Skill studio', sub: 'New · the foundations behind everything', items: skill });
  g.push({ id: 'reading', name: 'Reading & watching', sub: 'New · learn from stories and TV', items: cards('reading', function () { return 'Reading & watching'; }) });
  g.push({ id: 'career', name: 'Career English', sub: 'Dental hygiene, sales, hair & makeup', items: cards('career', function () { return 'Career English'; }) });
  g.push({ id: 'citizen', name: 'Citizenship', sub: 'The civics test and the interview', items: cards('citizen', function () { return 'Citizenship'; }) });
  if (SE.courseVisible('adult') && cs.adult && cs.adult.levels.length) g.push({ id: 'adult', name: 'Love & Intimacy', sub: '18+ · clear, respectful vocabulary', items: cards('adult', function () { return 'Love & Intimacy · 18+'; }) });
  return g.filter(function (x) { return x.items.length; });
}
function libCard(m) {
  var lessons = m.lv.lessons, p = Math.round(lessons.reduce(function (a, l) { return a + SE.pct(l.id); }, 0) / Math.max(1, lessons.length));
  var cta = p >= 100 ? 'Review · done' : p > 0 ? 'Continue · ' + p + '%' : 'Start · or test out';
  var img = m.img && SE.imgRec(m.img) ? m.img : null; for (var i = 0; i < lessons.length && !img; i++) { var k = lessonImg(lessons[i]); if (SE.imgRec(k)) img = k; }
  var href = m.gym ? '#/practice/gym' : m.grammar ? '#/journey/' + (function () { var gl = ENG.courses.school.levels; for (var j = 0; j < gl.length; j++) if (!SE.levelDone(gl[j])) return gl[j].id; return gl[0].id; })() : '#/journey/' + m.lv.id;
  var desc = m.lv.blurb || m.c.blurb || '';
  if (desc.length > 110) desc = desc.slice(0, 107).replace(/\s+\S*$/, '') + '…';
  return '<a class="card lcard2" href="' + href + '"><div class="lph">' + photo(img || lessons[0].img, 'fill', m.lv.title) + (m.isNew ? '<span class="newtag">NEW</span>' : '') + '</div>' +
    '<div class="lb"><div class="eyebrow">' + esc(m.eyebrow.toUpperCase()) + '</div><div class="ltl">' + esc(m.lv.title) + '</div><div class="ld">' + esc(desc) + '</div>' +
    '<div class="lfoot"><div class="bar thin"><i style="width:' + p + '%"></i></div><div class="lmeta"><span class="link">' + cta + '</span><span class="muted">' + lessons.length + ' ' + (m.gym ? 'drills' : m.grammar ? 'units' : lessons.length === 1 ? 'lesson' : 'lessons') + '</span></div></div></div></a>';
}
function viewLibrary(main) {
  var groups = libGroups(), total = groups.reduce(function (a, g) { return a + g.items.length; }, 0);
  var h = '<div class="page library"><div class="libhead"><div><div class="eyebrow">Library · ' + total + ' courses</div><h1 class="h1">Everything you can <i>learn here.</i></h1></div>' +
    '<label class="search libsearch"><span class="o"></span><input id="libq" placeholder="Search lessons, words, topics…" autocomplete="off"></label></div>' +
    '<div class="fchips"><button class="fchip' + (LIB_FILTER === 'all' ? ' on' : '') + '" data-f="all">All <span>' + total + '</span></button>' +
    groups.map(function (g) { return '<button class="fchip' + (LIB_FILTER === g.id ? ' on' : '') + '" data-f="' + g.id + '">' + esc(g.name) + ' <span>' + g.items.length + '</span></button>'; }).join('') + '</div><div id="libres"></div><div id="libgroups">';
  groups.forEach(function (g) {
    if (LIB_FILTER !== 'all' && LIB_FILTER !== g.id) return;
    h += '<section class="lgroup"><div class="lgh"><h2 class="h2">' + esc(g.name) + '</h2><span class="muted">' + esc(g.sub) + '</span></div><div class="lgrid">' + g.items.map(libCard).join('') + '</div></section>';
  });
  main.innerHTML = h + '</div></div>';
  $$('.fchip', main).forEach(function (b) { b.onclick = function () { LIB_FILTER = b.getAttribute('data-f'); viewLibrary(main); }; });
  var q = $('#libq', main), res = $('#libres', main);
  q.oninput = function () {
    var t = q.value.trim().toLowerCase();
    if (t.length < 2) { res.innerHTML = ''; $('#libgroups', main).classList.remove('hide'); return; }
    var LS = IX().LESSONS, out = [];
    Object.keys(LS).forEach(function (lid) { if (!SE.lidVisible(lid)) return; var ls = LS[lid].lesson; if ((ls.title + ' ' + (ls.goal || '')).toLowerCase().indexOf(t) >= 0) out.push(lid); });
    var words = IX().WORDS.filter(function (w) { return SE.lidVisible(w.lid) && ((w.w.w || '') + ' ' + (w.w.fr || '') + ' ' + (w.w.def || '')).toLowerCase().indexOf(t) >= 0; }).slice(0, 10);
    var mods = [];
    groups.forEach(function (g) { g.items.forEach(function (m) { if ((m.lv.title + ' ' + (m.lv.blurb || '')).toLowerCase().indexOf(t) >= 0) mods.push(m); }); });
    res.innerHTML = '<div class="sres">' +
      (mods.length ? '<div class="sgroup"><div class="eyebrow">Courses</div><div class="lgrid">' + mods.slice(0, 8).map(libCard).join('') + '</div></div>' : '') +
      '<div class="sgroup"><div class="eyebrow">Lessons · ' + out.length + '</div>' + (out.slice(0, 20).map(function (lid) { var L = LS[lid]; return '<a class="srch-row" href="#/journey/' + L.level.id + '/' + lid + '"><span class="sr-t">' + esc(plainTitle(L.lesson.title)) + '</span><span class="muted small">' + esc(where(lid)) + '</span></a>'; }).join('') || '<div class="muted small">No lessons found.</div>') + '</div>' +
      '<div class="sgroup"><div class="eyebrow">Words · ' + words.length + '</div>' + (words.map(function (w) { var L = LS[w.lid]; return '<a class="srch-row" href="#/journey/' + L.level.id + '/' + w.lid + '"><span class="sr-t serif">' + esc(w.w.w) + '</span>' + (w.w.fr ? '<span class="fr-line">' + esc(w.w.fr) + '</span>' : '') + '<span class="muted small">' + esc(w.w.def || '') + '</span></a>'; }).join('') || '<div class="muted small">No words found.</div>') + '</div></div>';
    $('#libgroups', main).classList.add('hide');
  };
}

/* ---------------------------------------------------------------- Progress (3d) */
function viewProgress(main) {
  var s = S(), ri = rankInfo(), LS = IX().LESSONS;
  var started = s.started || SE.dstr(), sd = new Date(started + 'T12:00:00'), weeks = Math.max(1, Math.round((Date.now() - sd.getTime()) / (7 * 86400000)));
  var lessonsDone = Object.keys(s.lessons).filter(function (l) { return LS[l] && SE.isDone(l); }).length;
  var wordsSaved = Object.keys(s.words || {}).filter(function (k) { return s.words[k] >= 2; }).length + Object.keys(s.cards || {}).filter(function (k) { return s.cards[k].reps >= 1; }).length + Object.keys(s.saved || {}).length;
  var h = '<div class="page progress"><div class="phead"><div><div class="eyebrow">Since ' + MONTHS[sd.getMonth()] + ' ' + sd.getDate() + ' · ' + weeks + ' week' + (weeks > 1 ? 's' : '') + '</div><h1 class="h1">Look how far <i>you\'ve come.</i></h1></div>' +
    '<div class="stats">' + [[n(s.xp), 'points'], [SE.streakNow(), 'day streak'], [lessonsDone, 'lessons done'], [wordsSaved, 'words saved']].map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div></div>';
  /* rank ladder */
  var R = SE.RANKS, seg = 100 / (R.length - 1), fill = (ri.i + ri.frac) * seg;
  h += '<div class="card lg ladder"><div class="lh"><span class="eyebrow rose">Your rank</span><h2 class="h2">' + esc(ri.name) + '</h2><span class="lto">' + (ri.next ? '<b>' + n(ri.toNext) + ' pts</b> to ' + esc(ri.next[1]) : 'You reached the top rank!') + '</span></div>' +
    '<div class="rtrack"><div class="rt0"></div><div class="rt1" style="width:' + Math.min(100, fill) + '%"></div><div class="rnodes">' +
    R.map(function (r, i) { var cls = i < ri.i ? 'past' : i === ri.i ? 'cur' : 'fut'; return '<div class="rnode ' + cls + '"><span class="rc">' + (i + 1) + '</span><b>' + esc(r[1]) + '</b><small>' + (r[0] ? n(r[0]) : '0 pts') + '</small></div>'; }).join('') + '</div></div>' +
    '<div class="earn"><span class="muted b6">How to earn points</span>' + [['Lesson', SE.PTS.lesson], ['Review cards', SE.PTS.review], ['Test out', SE.PTS.testOut], ['3 stars', SE.PTS.stars3], ['7-day streak', SE.PTS.streak7]].map(function (e) { return '<span class="echip">' + e[0] + ' <b>+' + e[1] + '</b></span>'; }).join('') + '</div></div>';
  /* level rings */
  var pl = pathLevels(), next = SE.planNext(), nL = next && LS[next], curLv = nL && nL.course.id === 'path' ? nL.level.id : null;
  h += '<div class="sech"><h2 class="h2">Your ' + (pl.length === 8 ? 'eight' : pl.length) + ' levels</h2><span class="muted">A2 → C1. Lavender is what you tested out of.</span></div><div class="lrings">' +
    pl.map(function (lv, i) {
      var p = SE.levelPct(lv), kp = SE.levelKnewPct(lv), here = lv.id === curLv;
      var act = here ? 'You\'re here' : p >= 100 ? 'Done' : p > 0 ? 'Continue' : 'Test out', ac = here ? 'var(--rose-text)' : 'var(--muted)';
      return '<a class="lring' + (here ? ' here' : '') + '" href="#/journey/' + lv.id + '">' + SE.ui.ring(p, 100, '<b>' + (i + 1) + '</b><small>' + p + '%</small>', { lav: kp, th: 10 }) + '<span class="lrt">' + esc(lv.title) + '</span><span class="lrc">' + esc(lv.cefr || '') + '</span><span class="lra" style="color:' + ac + '">' + act + '</span></a>';
    }).join('') + '</div>';
  /* skills + calendar */
  var sk = SE.skills(), low = sk.slice().sort(function (a, b) { return a[1] - b[1]; }).slice(0, 2);
  var tips = { Sounds: ['Say a few sentences out loud in the Sound gym.', '#/practice/sound'], Grammar: ['A round of Fill the gap trains grammar fast.', '#/practice/gap'], Words: ['Review cards keep new words fresh.', '#/practice/review'], Reading: ['Read one short story in the Reading room.', '#/library'], Listening: ['Play one conversation in your next lesson.', '#/home'], Conversation: ['A quick chat practice helps.', '#/practice/chat'], Writing: ['Finish a writing step in your next lesson.', '#/home'], 'American life': ['Open a Life in Tampa module.', '#/library'] };
  var tip = tips[low[0][0]] || ['Keep going!', '#/home'];
  h += '<div class="two"><div class="card lg skillc"><div class="ch"><h3 class="h3">Skill balance</h3><span class="muted small b6">out of 100</span></div><div class="skills">' +
    sk.map(function (x) { return '<div class="skr"><span>' + esc(x[0]) + '</span><div class="bar sk"><i style="width:' + x[1] + '%;background:' + (x[1] < 40 ? 'var(--peach)' : 'var(--rose)') + '"></i></div><span class="muted">' + x[1] + '</span></div>'; }).join('') +
    '</div><a class="sugg" href="' + tip[1] + '"><span><b>' + esc(low[0][0]) + ' and ' + esc(low[1][0].toLowerCase()) + ' are lowest.</b> ' + esc(tip[0]) + '</span><span class="go">Try it →</span></a></div>' +
    '<div class="card lg calc2"><div class="ch"><h3 class="h3">' + MONTHS[new Date().getMonth()] + '</h3><span class="muted small b6">' + monthDays() + ' days · best streak ' + (s.streak.best || s.streak.n || 0) + '</span></div>' + calendarHTML(true) +
    '<div class="clegend">Less<i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i>More</div></div></div>';
  /* sticker book */
  var st = SE.stickers().map(function (x) { if (x.id.indexOf('l:') === 0 && LS[x.id.slice(2)]) x.label = shortName(LS[x.id.slice(2)].lesson); return x; }), got = st.filter(function (x) { return x.got; }), nextS = st.filter(function (x) { return !x.got; })[0];
  var slots = got.map(function (x, i) { return '<div class="stk ' + x.color + '" style="transform:rotate(' + ((i * 37) % 13 - 6) + 'deg)" title="' + esc(x.label) + '"><span>' + esc(x.label) + '</span></div>'; });
  if (nextS) slots.push('<div class="stk next" title="Next: ' + esc(nextS.label) + '"><span>' + esc(nextS.label) + '</span></div>');
  var minSlots = Math.max(24, Math.ceil((slots.length + 1) / 12) * 12);
  while (slots.length < minSlots) slots.push('<div class="stk empty"></div>');
  h += '<div class="card lg stickers"><div class="ch"><h3 class="h3">Sticker book</h3><span class="muted small b6">' + got.length + ' of ' + st.length + ' · one for every lesson and milestone</span></div><div class="sgrid">' + slots.join('') + '</div></div>';
  /* lesson history */
  var rows = Object.keys(LS).filter(function (l) { return SE.lidVisible(l) && (SE.isDone(l) || s.prog[l]); });
  rows.sort(function (a, b) { var ta = (s.prog[a] || {}).t || (s.lessons[a] || {}).date || '', tb = (s.prog[b] || {}).t || (s.lessons[b] || {}).date || ''; return tb > ta ? 1 : -1; });
  h += '<div class="card lg history"><div class="ch"><h3 class="h3">Lesson history</h3><span class="muted small b6">' + rows.length + ' lessons opened</span></div>' +
    (rows.length ? '<table class="htable"><tr><th>Lesson</th><th>Where</th><th>Status</th><th>Last</th></tr>' + rows.slice(0, 60).map(function (l) {
      var st2 = SE.lessonState(l), stx = st2.state === 'finished' ? SE.ui.stars(st2.stars) : st2.state === 'knew' ? '<span class="lav">Tested out · ' + (st2.score || 0) + '%</span>' : st2.pct + '%';
      return '<tr><td><a href="#/journey/' + LS[l].level.id + '/' + l + '">' + esc(plainTitle(LS[l].lesson.title)) + '</a></td><td class="muted">' + esc(where(l)) + '</td><td>' + stx + '</td><td class="muted">' + esc(((s.prog[l] || {}).t || (s.lessons[l] || {}).date || '').slice(0, 10)) + '</td></tr>';
    }).join('') + '</table>' : '<p class="muted">No lessons opened yet. Start one from Today.</p>') + '</div>';
  main.innerHTML = h + '</div>';
}

/* ---------------------------------------------------------------- Settings */
function viewSettings(main) {
  var s = S(), st = s.settings;
  var h = '<div class="page settings"><div class="eyebrow">Settings</div><h1 class="h1">Make it <i>yours.</i></h1><div class="setgrid">' +
    '<div class="card lg setc"><h3 class="h3">You</h3>' +
    '<label class="srow2"><span><b>Your name</b><small>Shown on Today.</small></span><input class="field" id="s-name" value="' + esc(st.name || '') + '" maxlength="30"></label>' +
    '<label class="srow2"><span><b>Daily goal</b><small>Points per day.</small></span><select class="field" id="s-goal">' + [50, 100, 150, 200, 300].map(function (g) { return '<option value="' + g + '"' + ((st.goal || 150) === g ? ' selected' : '') + '>' + g + ' points</option>'; }).join('') + '</select></label>' +
    '<label class="srow2 tog"><span><b>French help</b><small>Show the French under the English, everywhere.</small></span><input type="checkbox" id="s-fr"' + (st.frenchHelp !== false ? ' checked' : '') + '><i class="sw"></i></label>' +
    '<label class="srow2 tog"><span><b>Dark theme</b><small>The light theme is the main design.</small></span><input type="checkbox" id="s-dark"' + (st.theme === 'dark' ? ' checked' : '') + '><i class="sw"></i></label>' +
    '<label class="srow2 tog"><span><b>Show the 18+ section</b><small>Love & Intimacy: adult relationship vocabulary.</small></span><input type="checkbox" id="s-adult"' + (st.adult ? ' checked' : '') + '><i class="sw"></i></label></div>' +
    '<div class="card lg setc"><h3 class="h3">Sound & writing</h3>' +
    '<label class="srow2 tog"><span><b>Play audio automatically</b><small>Off by default. Tap ▶ to listen when you want.</small></span><input type="checkbox" id="s-auto"' + (st.autoplay ? ' checked' : '') + '><i class="sw"></i></label>' +
    '<label class="srow2"><span><b>Voice speed</b><small>For the ▶ Listen buttons.</small></span><span class="rng"><input type="range" id="s-rate" min="0.6" max="1.2" step="0.05" value="' + (st.rate || 0.95) + '"><button class="btn sm" id="s-test">▶ Test</button></span></label>' +
    '<label class="srow2 tog"><span><b>Online grammar check</b><small>Writing feedback also asks LanguageTool.org (sends the text).</small></span><input type="checkbox" id="s-online"' + (st.online ? ' checked' : '') + '><i class="sw"></i></label></div>' +
    safeCardHTML() +
    '</div></div>';
  main.innerHTML = h;
  $('#s-name', main).onchange = function () { st.name = this.value.trim() || 'Morgane'; SE.save(); renderShell(); SE.toast('Saved'); };
  $('#s-goal', main).onchange = function () { st.goal = +this.value; SE.save(); SE.toast('Daily goal: ' + st.goal + ' points'); };
  $('#s-fr', main).onchange = function () { SE.setFrench(this.checked); };
  $('#s-dark', main).onchange = function () { st.theme = this.checked ? 'dark' : 'light'; SE.save(); SE.applyTheme(); };
  $('#s-adult', main).onchange = function () {
    if (this.checked && !window.confirm('Show the Love & Intimacy section? It\'s adult (18+) relationship and intimacy vocabulary.')) { this.checked = false; return; }
    st.adult = this.checked; SE.save(); renderShell(); SE.toast(st.adult ? 'The 18+ section is in the Library' : 'The 18+ section is hidden');
  };
  $('#s-auto', main).onchange = function () { st.autoplay = this.checked; SE.save(); };
  $('#s-rate', main).onchange = function () { st.rate = +this.value; SE.save(); };
  $('#s-test', main).onclick = function () { SE.speak('This is how fast I will talk.'); };
  $('#s-online', main).onchange = function () { st.online = this.checked; SE.save(); };
  bindSafe(main);
  $('#s-reset', main).onclick = function () { if (window.confirm('Reset ALL progress? This can\'t be undone. Download a backup first if you\'re not sure.')) { SE.resetState(); SE.toast('Progress reset'); } };
}


/* ---------------------------------------------------------------- keeping progress safe (backup file in site/progress) */
function ago(t) { if (!t) return 'never'; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; }
var LOCAL = location.protocol === 'file:';   /* opened from the folder (file://) vs. hosted online (GitHub Pages) */
function CL() { return window.SECloud && window.SECloud.configured() ? window.SECloud : null; }
function cloudInfo() {
  var c = CL(); if (!c) return null;
  var st = c.status(), w = c.who(), last = st.lastPush || st.lastPull;
  if (!w) return { cls: 'warn', short: 'Not saving online', text: '<b>Not saving online yet.</b> Your progress is only in this browser right now.' };
  if (st.state === 'syncing') return { cls: 'busy', short: 'Saving…', text: '<b>Saving…</b>' };
  if (st.state === 'offline') return { cls: 'warn', short: 'Offline', text: '<b>Offline.</b> ' + esc(st.msg) };
  if (st.state === 'error') return { cls: 'bad', short: 'Not saved online', text: '<b>Couldn’t save online.</b> ' + esc(st.msg) + ' It will try again by itself.' };
  return { cls: 'ok', short: 'Saved online', text: '<b>Saved online</b>' + (last ? ' · ' + ago(last) : '') + '.' };
}
function cloudStatusHTML() { var i = cloudInfo(); return i ? '<span class="safe-dot ' + i.cls + '"></span><span>' + i.text + '</span>' : ''; }
function cloudDot() { var i = cloudInfo(); return i ? '<i class="cdot ' + i.cls + '"></i>' : ''; }
function avatarTitle() { var i = cloudInfo(); return 'Settings' + (i ? ' · ' + i.short : ''); }
function cloudBlockHTML() {
  var c = CL();
  if (!c) return '<div class="cloud-block off"><b>Online save: not set up yet.</b><span class="muted small">To save progress online (safe from clearing the browser), Sam follows SETUP_ONLINE_SAVE.md once.</span></div>';
  if (!c.who()) return '<div class="cloud-block"><div class="cb-h"><b>Online save</b></div><div class="safe-status" data-cloud-status>' + cloudStatusHTML() + '</div>' +
    '<p class="muted small" style="margin:-4px 0 12px">Tell us your first name and birthday once. Your progress then saves online too, and if the browser is ever cleared, typing them again brings everything back.</p>' + SE.frLine('Donne ton prénom et ton anniversaire une fois : ta progression est aussi sauvegardée en ligne.') +
    '<button class="btn primary" id="s-who">Save my progress online</button></div>';
  return '<div class="cloud-block"><div class="cb-h"><b>Saving as ' + esc(c.label()) + '</b><button class="link" id="s-switch">Switch person</button></div><div class="safe-status" data-cloud-status>' + cloudStatusHTML() + '</div>' +
    '<p class="muted small" style="margin:-4px 0 12px">If this browser is ever cleared, open the site and type the same first name and birthday: everything comes back.</p>' +
    '<div class="cb-btns"><button class="btn" id="s-cloudsave">Save now</button></div></div>';
}
function safeCardHTML() {
  var b = SE.backupStatus(), c = CL(), h = '';
  var intro = c ? 'Progress is saved in this browser automatically, and online under your first name and birthday. Clearing the cache or history can erase the browser copy, never the online one.'
    : LOCAL ? 'Progress is saved in this browser automatically. Clearing the cache or history can erase that copy, so the site also keeps a backup file in your folder and loads it back automatically.'
    : 'Progress is saved in this browser automatically. Clearing the cache or history can erase it, so download a backup file now and then.';
  h += '<div class="card lg setc safe"><h3 class="h3">Keep my progress safe</h3><p class="muted small" style="margin:4px 0 12px">' + intro + '</p>' + cloudBlockHTML();
  if (LOCAL) {
    var status = b.state === 'ok' ? '<span class="safe-dot ok"></span><span><b>Backup folder connected.</b> Every change is also saved to <b>site/progress</b> (last copy ' + ago(b.last) + ').</span>'
      : b.state === 'needs-permission' ? '<span class="safe-dot warn"></span><span><b>Paused.</b> The browser needs one click to keep saving into your folder.</span>'
      : b.supported ? '<span class="safe-dot"></span><span><b>' + (c ? 'Extra backup:' : 'Not protected yet.') + '</b> Connect the <b>site/progress</b> folder once, and progress also survives clearing the browser.</span>'
      : '<span class="safe-dot warn"></span><span>This browser can’t save into folders by itself. Download a backup now and then and put it in <b>site/progress</b>' + (b.lastDownload ? ' (last one ' + ago(b.lastDownload) + ')' : '') + '.</span>';
    h += '<div class="eyebrow" style="margin:6px 0 8px">Backup file</div><div class="safe-status">' + status + '</div><div class="sbtns">' +
      (b.supported ? (b.state === 'ok' ? '<button class="btn" id="s-connect">Change folder</button>' : b.state === 'needs-permission' ? '<button class="btn primary" id="s-resume">Keep saving to my folder</button>' : '<button class="btn' + (c ? '' : ' primary') + '" id="s-connect">Connect the site/progress folder</button>') : '') +
      '<button class="btn' + (b.supported || c ? '' : ' primary') + '" id="s-export">Download a backup</button><button class="btn" id="s-import">Load a backup</button><button class="btn danger" id="s-reset">Reset everything</button></div>' +
      '<p class="muted small" style="margin-top:12px">' + (b.supported ? 'When the folder picker opens, choose <b>French Website › site › progress</b>.' : 'Downloaded file: <b>progress-backup.js</b>. Move it into <b>French Website › site › progress</b> (replace the old one). The site loads it automatically.') + '</p></div>';
  } else {
    h += '<div class="eyebrow" style="margin:6px 0 8px">Backup file</div><div class="safe-status"><span class="safe-dot' + (c || Date.now() - (b.lastDownload || 0) < 7 * 86400000 ? ' ok' : ' warn') + '"></span><span>' + (c ? 'Extra safety: you can also keep a backup file on this device.' : 'Download a backup file now and then and keep it somewhere safe (Files, Downloads, iCloud…).') + (b.lastDownload ? ' Last one: ' + ago(b.lastDownload) + '.' : '') + '</span></div>' +
      '<div class="sbtns"><button class="btn' + (c ? '' : ' primary') + '" id="s-export">Download a backup file</button><button class="btn" id="s-import">Load a backup file</button><button class="btn danger" id="s-reset">Reset everything</button></div></div>';
  }
  return h;
}
function exportMsg() { return LOCAL ? 'Saved progress-backup.js. Put it in site/progress.' : 'Saved progress-backup.js in your downloads.'; }
function pickBackupFile() {
  var f = document.createElement('input'); f.type = 'file'; f.accept = '.js,.json,application/json,text/javascript';
  f.onchange = function () { var rd = new FileReader(); rd.onload = function () { try { SE.loadBackupText(rd.result); } catch (e) { SE.toast('That file didn’t work'); } }; rd.readAsText(f.files[0]); };
  f.click();
}
function bindSafe(root) {
  var c = $('#s-connect', root), r = $('#s-resume', root), x = $('#s-export', root), i = $('#s-import', root), cs = $('#s-cloudsave', root);
  if (c) c.onclick = function () { SE.connectBackupFolder().then(function () { SE.dispatch(); }); };
  if (r) r.onclick = function () { SE.resumeBackupFolder().then(function () { SE.dispatch(); }); };
  if (x) x.onclick = function () { SE.downloadBackup(); SE.toast(exportMsg()); setTimeout(function () { if (location.hash.indexOf('settings') >= 0) SE.dispatch(); }, 400); };
  if (i) i.onclick = pickBackupFile;
  if (cs) cs.onclick = function () { SE.save(); window.SECloud.saveNow().then(function () { var st = window.SECloud.status().state; SE.toast(st === 'ok' ? 'Saved online' : 'Not saved online yet: it will try again'); }); };
  var sw = $('#s-who', root), sp = $('#s-switch', root);
  if (sw) sw.onclick = function () { window.SECloud.prompt(); };
  if (sp) sp.onclick = function () { if (window.confirm('Switch to another person? This person’s progress stays saved online under their name and birthday.')) window.SECloud.switchPerson(); };
  SE.bindGo(root);
}
/* a small banner on Today when progress needs protecting */
function safeBanner() {
  var s = S(), b = SE.backupStatus(), c = CL();
  if (c) {
    if (c.who()) return '';
    if (s.xp === 0) return '<div class="safe-banner"><span><b>Used Sunshine English before?</b> Type your first name and birthday and your progress comes right back.</span><button class="btn sm primary" data-safe="who">Bring it back</button></div>';
    return '<div class="safe-banner"><span><b>Save your progress online:</b> just your first name and birthday. Then clearing the browser can’t erase it.</span><button class="btn sm primary" data-safe="who">Set it up</button></div>';
  }
  if (s.xp === 0 && !b.fileFound) return '<div class="safe-banner"><span><b>Already have progress?</b> Load your backup file to continue where you left off.</span><button class="btn sm" data-safe="load">Load a backup</button></div>';
  if (s.xp < 30) return '';
  if (LOCAL && b.state === 'needs-permission') return '<div class="safe-banner"><span><b>Keep your progress safe:</b> one click to keep saving it to your folder.</span><button class="btn sm primary" data-safe="resume">Keep saving</button></div>';
  if (LOCAL && b.supported && b.state === 'none') return '<div class="safe-banner"><span><b>Protect your progress</b> from cache clearing: save it into your folder too.</span><button class="btn sm primary" data-go="#/settings">Set it up</button></div>';
  if ((!LOCAL || !b.supported) && Date.now() - (b.lastDownload || 0) > 3 * 86400000) return '<div class="safe-banner"><span><b>Time for a backup:</b> ' + (LOCAL ? 'download it and put it in site/progress.' : 'download your progress file and keep it somewhere safe.') + '</span><button class="btn sm primary" data-safe="download">Download a backup</button></div>';
  return '';
}
function bindSafeBanner(root) {
  $$('[data-safe]', root).forEach(function (btn) {
    btn.onclick = function () {
      var k = btn.getAttribute('data-safe');
      if (k === 'resume') SE.resumeBackupFolder().then(function () { SE.dispatch(); });
      else if (k === 'download') { SE.downloadBackup(); SE.toast(exportMsg()); setTimeout(SE.dispatch, 400); }
      else if (k === 'load') pickBackupFile();
      else if (k === 'who' && window.SECloud) window.SECloud.prompt();
    };
  });
  SE.bindGo(root);
}

/* live status updates without re-rendering forms */
SE.on('cloud', function () {
  $$('[data-cloud-status]').forEach(function (x) { x.innerHTML = cloudStatusHTML(); });
  var a = $('#topbar .avatar'); if (a) { var d = $('.cdot', a); if (d) d.outerHTML = cloudDot(); else a.insertAdjacentHTML('beforeend', cloudDot()); a.title = avatarTitle(); }
  var sb = $('#safeb'); if (sb) { var nh = safeBanner(); if (sb.innerHTML !== nh) { sb.innerHTML = nh; bindSafeBanner(sb); } }
  var blk = $('.cloud-block'); if (blk && !!$('#s-who', blk) === !!(CL() && CL().who())) SE.dispatch();
});

/* ---------------------------------------------------------------- Credits */
function viewCredits(main) {
  var keys = Object.keys(ENG.images || {}).filter(function (k) { return ENG.images[k] && ENG.images[k].u; }).sort();
  main.innerHTML = '<div class="page credits"><div class="eyebrow">Photo credits</div><h1 class="h1">Thank you, <i>photographers.</i></h1><p class="lead" style="margin-top:10px">Photos are saved in the <b>images</b> folder. Most come from Wikimedia Commons.</p>' +
    '<div class="cgrid">' + keys.map(function (k) { var im = ENG.images[k]; return '<div class="card ccard">' + photo(k, 'cph2') + '<div class="cb"><b>' + esc(ENG.imgq[k] || k.replace(/_/g, ' ')) + '</b><small>' + esc(im.by || '') + (im.lic ? ' · ' + esc(im.lic) : '') + '</small>' + (im.p ? '<a href="' + esc(im.p) + '" target="_blank" rel="noopener">source</a>' : '') + '</div></div>'; }).join('') + '</div>' +
    (keys.length ? '' : '<p class="muted">No photos yet.</p>') + '</div>';
}

/* ---------------------------------------------------------------- routes */
SE.route('home', viewToday);
SE.route('journey', viewJourney);
SE.route('library', viewLibrary);
SE.route('progress', viewProgress);
SE.route('settings', viewSettings);
SE.route('credits', viewCredits);
SE.route('account', function () { SE.go('#/settings'); });
SE.route('c', function (main, args) { var c = ENG.courses[args[0]]; SE.go(c && c.levels[0] ? '#/journey/' + c.levels[0].id : '#/library'); });
SE.app = { renderShell: renderShell, findLevel: findLevel, lessonImg: lessonImg, shortName: shortName, where: where, calendarHTML: calendarHTML, troubleHTML: troubleHTML, circle: circle };
})();
