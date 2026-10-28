/* Content registry. Loaded first; content files call these functions. */
window.ENG = {
  courses: {
    path:    { id: 'path',    title: 'Core path',             group: 'Core path',          unit: 'Level', blurb: 'The main course, A2 to C1: real life in Tampa, from everyday basics to fluent conversation.', levels: [] },
    school:  { id: 'school',  title: 'Grammar foundations',   group: 'Skill studio',       unit: 'Grade', blurb: 'Tenses, articles and word order, built from the ground up instead of translated. Like 8 years of school, condensed.', levels: [] },
    gym:     { id: 'gym',     title: 'Conventions gym',       group: 'Skill studio',       unit: 'Drill', blurb: 'Short, intense drills for the little words French speakers miss: I’m going to, am/is/are, to, do/does, a/the, his/her and more.', levels: [] },
    tampa:   { id: 'tampa',   title: 'Life in Tampa',         group: 'Life in Tampa',      unit: 'Module', blurb: 'Real situations, short modules.', levels: [] },
    skills:  { id: 'skills',  title: 'Skill studio',          group: 'Skill studio',       unit: 'Module', blurb: 'The foundations behind everything.', levels: [] },
    reading: { id: 'reading', title: 'Reading & watching',    group: 'Reading & watching', unit: 'Module', blurb: 'Learn from stories and TV.', levels: [] },
    career:  { id: 'career',  title: 'Career English',        group: 'Career English',     unit: 'Course', blurb: 'English for the jobs you want: dental hygiene, sales, hair & makeup.', levels: [] },
    citizen: { id: 'citizen', title: 'Citizenship',           group: 'Citizenship',        unit: 'Course', blurb: 'The civics test, the interview, and the reading & writing test.', levels: [] },
    adult:   { id: 'adult',   title: 'Love & Intimacy (18+)', group: 'Love & Intimacy',    unit: 'Course', blurb: 'Relationship and intimacy vocabulary for adults: clear, respectful, and practical.', levels: [] }
  },
  plan: [],       // ordered lesson ids: the recommended sequence (content/plan.js)
  phrases: [],
  imgq: {},       // image key -> search query (what the photo should show)
  images: {},     // image key -> { u: 'images/key.jpg', f, by, lic, p }
  addLevel: function (course, level) {
    if (!this.courses[course]) this.courses[course] = { id: course, title: course, group: course, levels: [] };
    this.courses[course].levels.push(level);
  },
  setPlan: function (ids) { this.plan = ids.slice(); },
  needImages: function (o) { for (var k in o) if (!this.imgq[k]) this.imgq[k] = o[k]; },
  addPhrases: function (a) { this.phrases.push.apply(this.phrases, a); }
};
