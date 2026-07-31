// Quick sanity checks for the word-level hallucination guard.
// Run with: npm test
const { guardCorrection } = require('./lib/checker');

const cases = [
  {
    name: 'real user case: keeps საქემ→საქმეს, undoes ადანაშაულებს→დასაშლელად',
    input: '18 წლის შემდეგ აღდგენილი სამართალი - ზესტაფონში მცხოვრები მერაბ დარბაიძე ნაციონალურ მოძრაობას საქმის გაყალბებაში ადანაშაულებს. საქემ ეხება 2008 წელს მომხდარ ავარიას, რომლის დროსაც მისი შვილი, 26 წლის სამხედრო ოფიცერი გიორგი დარბაიძე გარდაიცვალა.',
    model: '18 წლის შემდეგ აღდგენილი სამართალი - ზესტაფონში მცხოვრები მერაბ დარბაიძე ნაციონალურ მოძრაობას საქმის გაყალბებაში დასაშლელად. საქმეს ეხება 2008 წელს მომხდარ ავარიას, რომლის დროსაც მისი შვილი, 26 წლის სამხედრო ოფიცერი გიორგი დარბაიძე გარდაიცვალა.',
    expectContains: ['ადანაშაულებს.', 'საქმეს'],
    expectMissing: ['დასაშლელად'],
  },
  {
    name: 'legit fix: შეურაცყოფა → შეურაცხყოფა',
    input: 'ეს არის შეურაცყოფა.',
    model: 'ეს არის შეურაცხყოფა.',
    expectContains: ['შეურაცხყოფა.'],
  },
  {
    name: 'legit fix: ერთერთი → ერთ-ერთი',
    input: 'ის ერთერთი საუკეთესოა.',
    model: 'ის ერთ-ერთი საუკეთესოა.',
    expectContains: ['ერთ-ერთი'],
  },
  {
    name: 'legit fix: პრემიერმინისტრის → პრემიერ-მინისტრის',
    input: 'პრემიერმინისტრის განცხადება.',
    model: 'პრემიერ-მინისტრის განცხადება.',
    expectContains: ['პრემიერ-მინისტრის'],
  },
  {
    name: 'blocks invented word: პრემიერმინისტრი → პრემიერმაინისტრიელობა',
    input: 'პრემიერმინისტრი მოვიდა.',
    model: 'პრემიერმაინისტრიელობა მოვიდა.',
    expectContains: ['პრემიერმინისტრი'],
    expectMissing: ['პრემიერმაინისტრიელობა'],
  },
  {
    name: 'blocks word deletion',
    input: 'ეს არის ძალიან კარგი ტექსტი.',
    model: 'ეს არის კარგი ტექსტი.',
    expectContains: ['ძალიან'],
  },
  {
    name: 'blocks word insertion',
    input: 'ეს არის კარგი ტექსტი.',
    model: 'ეს არის ძალიან კარგი ტექსტი.',
    expectMissing: ['ძალიან'],
  },
  {
    name: 'clean text passes through untouched',
    input: 'ეს ტექსტი სრულიად სწორია.',
    model: 'ეს ტექსტი სრულიად სწორია.',
    expectContains: ['ეს ტექსტი სრულიად სწორია.'],
  },
  {
    name: 'preserves newlines and spacing',
    input: 'პირველი ხაზი\n\n  მეორე  ხაზი საქემ',
    model: 'პირველი ხაზი\n\n  მეორე  ხაზი საქმეს',
    expectContains: ['პირველი ხაზი\n\n  მეორე  ხაზი საქმეს'],
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const { text, rejected } = guardCorrection(c.input, c.model);
  let ok = true;
  const problems = [];
  for (const s of c.expectContains || []) {
    if (!text.includes(s)) { ok = false; problems.push(`missing expected: "${s}"`); }
  }
  for (const s of c.expectMissing || []) {
    if (text.includes(s)) { ok = false; problems.push(`should not contain: "${s}"`); }
  }
  if (ok) { pass++; console.log(`PASS  ${c.name}  (rejected: ${rejected})`); }
  else {
    fail++;
    console.log(`FAIL  ${c.name}`);
    problems.forEach(p => console.log(`      ${p}`));
    console.log(`      got: ${JSON.stringify(text)}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
