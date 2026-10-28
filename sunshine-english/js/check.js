/* Answer checking + writing feedback rules. Shared by the app (browser) and tools/validate.js (node).
   Lenient on purpose: capitals, punctuation, commas and apostrophes never make an answer wrong. */
(function (root) {
'use strict';
function arr(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }
var CONTR = [
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/\b(\w+)n't\b/g, '$1 not'], [/\bi'm\b/g, 'i am'], [/\blet's\b/g, 'let us'],
  [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'ll\b/g, '$1 will'], [/\b(\w+)'d\b/g, '$1 would'],
  [/\b(he|she|it|that|what|there|here|who|where|how|when|why|this|everything|nothing|something|everyone|someone|today|name)'s\b/g, '$1 is'],
  [/^'m$/g, 'am'], [/^'s$/g, 'is'], [/^'re$/g, 'are'], [/^'ve$/g, 'have'], [/^'ll$/g, 'will'], [/^'d$/g, 'would']
];
/* without apostrophes, people type "im", "dont", "its", "youre"… */
var BARE = { im: 'i am', ive: 'i have', id: 'i would', ill: 'i will', youre: 'you are', youve: 'you have', youll: 'you will', youd: 'you would',
  hes: 'he is', shes: 'she is', its: 'it is', were_: 'we are', theyre: 'they are', theyve: 'they have', theyll: 'they will', weve: 'we have', thats: 'that is',
  whats: 'what is', theres: 'there is', dont: 'do not', doesnt: 'does not', didnt: 'did not', cant: 'can not', wont: 'will not', isnt: 'is not', arent: 'are not',
  wasnt: 'was not', werent: 'were not', havent: 'have not', hasnt: 'has not', hadnt: 'had not', couldnt: 'could not', wouldnt: 'would not', shouldnt: 'should not', lets: 'let us', hows: 'how is', wheres: 'where is', whos: 'who is' };
function base(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
function norm(s) {
  s = base(s);
  CONTR.forEach(function (c) { s = s.replace(c[0], c[1]); });
  s = s.replace(/[^a-z0-9à-ÿ' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
  s = s.split(' ').map(function (w) { return BARE[w] || w; }).join(' ');
  return s;
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  var m = [], i, j;
  for (i = 0; i <= b.length; i++) m[i] = [i];
  for (j = 0; j <= a.length; j++) m[0][j] = j;
  for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
    m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}
var BASEV = 'work like love live go come want need have do make take get know think say see eat drink play speak call help walk talk watch listen start finish clean cook drive buy pay open close study learn teach read write sleep wake leave arrive stay move feel look use try ask answer tell give find bring send meet run swim sell understand remember forget wear wash brush floss rinse explain book cancel order sit stand hurt happen change carry wait visit travel shop hope plan miss enjoy prefer agree mean vote own claim live serve file owe register return refund fix rent text email text'.split(' ');
var BASESET = {}; BASEV.forEach(function (w) { BASESET[w] = 1; });
var IRR = { went: 'go', saw: 'see', did: 'do', had: 'have', ate: 'eat', made: 'make', took: 'take', came: 'come', got: 'get', bought: 'buy', said: 'say', told: 'tell', gave: 'give', found: 'find', thought: 'think', knew: 'know', left: 'leave', felt: 'feel', met: 'meet', ran: 'run', wrote: 'write', spoke: 'speak', drove: 'drive', slept: 'sleep', began: 'begin', brought: 'bring', sent: 'send', paid: 'pay', sold: 'sell', understood: 'understand', heard: 'hear', kept: 'keep', lost: 'lose', drank: 'drink', swam: 'swim', woke: 'wake', wore: 'wear', sat: 'sit', stood: 'stand', taught: 'teach', forgot: 'forget', was: 'be', were: 'be', gone: 'go', seen: 'see', eaten: 'eat', taken: 'take', written: 'write', spoken: 'speak', done: 'do', been: 'be',
  broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose', fell: 'fall', fallen: 'fall', spent: 'spend', built: 'build', caught: 'catch', flew: 'fly', flown: 'fly', grew: 'grow', grown: 'grow', held: 'hold', rode: 'ride', ridden: 'ride', rang: 'ring', rung: 'ring', sang: 'sing', sung: 'sing', shook: 'shake', shaken: 'shake', stole: 'steal', stolen: 'steal', threw: 'throw', thrown: 'throw', tore: 'tear', torn: 'tear', won: 'win', worn: 'wear', given: 'give', gotten: 'get', known: 'know', driven: 'drive', forgotten: 'forget', begun: 'begin', drunk: 'drink', swum: 'swim', blew: 'blow', blown: 'blow', drew: 'draw', drawn: 'draw', froze: 'freeze', frozen: 'freeze', hid: 'hide', hidden: 'hide', bit: 'bite', bitten: 'bite', woken: 'wake', ate_: 'eat' };
function thirdToBase(w) {
  if (w === 'has') return 'have'; if (w === 'does') return 'do'; if (w === 'goes') return 'go';
  if (/ies$/.test(w) && BASESET[w.slice(0, -3) + 'y']) return w.slice(0, -3) + 'y';
  if (/es$/.test(w) && BASESET[w.slice(0, -2)]) return w.slice(0, -2);
  if (/s$/.test(w) && BASESET[w.slice(0, -1)]) return w.slice(0, -1);
  return null;
}
var GRAMW = {}; ('a an the of on in at to for by with from about into do does did done doing has have had having is are was were be been am will would can could should must may might more most than then there their they this that these those it its he she his her him we you your me my i our us who which what whose ever never not no some any much many').split(' ').forEach(function (w) { GRAMW[w] = 1; });
function isGramWord(w) {
  if (GRAMW[w] || BASESET[w] || IRR[w]) return true;
  if (thirdToBase(w)) return true;
  if (/(ed|ing)$/.test(w) && (BASESET[w.replace(/(ed|ing)$/, '')] || BASESET[w.replace(/(ed|ing)$/, 'e')] || BASESET[w.replace(/d$/, '')])) return true;
  return false;
}
/* x and y are two forms of the same word (friend/friends, broke/broken): a grammar difference, never a typo */
function morph(x, y) {
  var sfx = ['s', 'es', 'd', 'ed', 'n', 'en', 'ing', 'r', 'er', 'st', 'est', 'ly'];
  for (var i = 0; i < sfx.length; i++) if (x === y + sfx[i] || y === x + sfx[i]) return true;
  if (IRR[x] && (IRR[x] === y || IRR[x] === IRR[y])) return true;
  if (IRR[y] && IRR[y] === x) return true;
  return false;
}
function checkAnswer(input, answers, wrong) {
  var n = norm(input); answers = arr(answers);
  if (!n) return { ok: false, empty: true, best: answers[0] };
  for (var i = 0; i < answers.length; i++) if (norm(answers[i]) === n) return { ok: true, best: answers[i] };
  if (wrong && norm(wrong) === n) return { ok: false, best: answers[0], same: true };
  var nw = n.split(' ');
  var stem = function (w) { return w.replace(/(ies|es|s|ed|d|ing)$/, '').replace(/e$/, ''); };
  for (var j = 0; j < answers.length; j++) {
    var aw = norm(answers[j]).split(' ');
    if (aw.length !== nw.length) continue;
    var diff = [];
    for (var k = 0; k < aw.length; k++) if (aw[k] !== nw[k]) diff.push(k);
    if (diff.length !== 1) continue;
    var x = nw[diff[0]], y = aw[diff[0]];
    if (y.length >= 4 && lev(x, y) === 1 && !isGramWord(x) && !isGramWord(y) && stem(x) !== stem(y) && !morph(x, y)) return { ok: true, typo: true, best: answers[j] };
  }
  return { ok: false, best: answers[0] };
}
/* "describe the photo": which idea groups are present? */
function ideasHit(text, need) {
  var low = ' ' + base(text).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ') + ' ', exp = ' ' + norm(text) + ' ';
  return (need || []).map(function (g) {
    return g.some(function (w) { var nw = norm(w), bw = base(w); return low.indexOf(' ' + bw) >= 0 || exp.indexOf(' ' + nw + ' ') >= 0 || exp.indexOf(' ' + nw) >= 0; });
  });
}
var api = { norm: norm, checkAnswer: checkAnswer, ideasHit: ideasHit, lev: lev, IRR: IRR, BASESET: BASESET, thirdToBase: thirdToBase, arr: arr };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SECHECK = api;
})(this);
