// Core spell-checking logic, shared by the local dev server (server.js) and the
// Vercel serverless function (api/check.js) so both behave identically.

// Read env lazily, at request time rather than module load, so it doesn't
// matter whether dotenv (or Vercel's env injection) ran before this import.
const getApiKey = () => process.env.GROQ_API_KEY;
// NOTE: llama-3.1-8b-instant is a tiny, fast model — it's weak at low-resource
// languages like Georgian and misses even common errors. openai/gpt-oss-120b is
// Groq's strongest general-purpose model (also free-tier), and is far more
// reliable for this task. Groq is also retiring llama-3.1-8b-instant (Aug 2026).
const getModel = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `შენ ხარ ქართული ენის მართლწერის (ორთოგრაფიის) გამსწორებელი ინსტრუმენტი. იყავი ყურადღებული და ზედმიწევნით ზუსტი — გადაამოწმე ყოველი სიტყვა ცალ-ცალკე, ნუ გამოტოვებ დახვეწილ, "წვრილ" შეცდომებს.

განსაკუთრებული ყურადღება მიაქციე ქართულში ხშირი, ძნელად შესამჩნევ არევებს, მაგალითად:
- "ხ" და "ყ" ბგერების არევა სიტყვებში, სადაც ორივე გვხვდება (მაგ. შეცდომა: "შეურაცყოფა" → სწორია: "შეურაცხყოფა"; შეცდომა: "შეურაცყოფილი" → სწორია: "შეურაცხყოფილი").
- გამოტოვებული ან ზედმეტი ასო სიტყვის ბოლოში ან შუაში (მაგ. შეცდომა: "გამოძიებულპ" → სწორია: "გამოძიებული").
- "თ"/"ტ", "ფ"/"პ", "ქ"/"კ" მსგავსი ბგერების არევა.
- ორმაგი ან გამოტოვებული თანხმოვნები.
- ორმაგი, შედგენილი (რთული) სიტყვები, რომლებსაც დეფისი სჭირდება, მაგრამ ერთად ან დეფისის გარეშეა დაწერილი. მაგალითები:
  - "ერთერთი" → "ერთ-ერთი"
  - "პრემიერმინისტრი" / "პრემიერმინისტრის" → "პრემიერ-მინისტრი" / "პრემიერ-მინისტრის"
  - "ვიცეპრეზიდენტი" → "ვიცე-პრეზიდენტი"
  - "გენერალურპროკურორი" → "გენერალურ-პროკურორი"
  ასეთი ტიპის სხვა შედგენილი წოდება/თანამდებობა/რიცხვითი გამეორების სიტყვების დროსაც დაამატე დეფისი იმავე პრინციპით, თუ დარწმუნებული ხარ, რომ ეს სწორი ფორმაა.

ძალიან მნიშვნელოვანი წესი — არასდროს გამოიგონო:
- თუ სიტყვაში ხედავ შესაძლო შეცდომას, მაგრამ არ ხარ ბოლომდე დარწმუნებული, რა არის ზუსტად სწორი ვარიანტი, დატოვე სიტყვა ზუსტად ისე, როგორც დაწერილია. სჯობს არასწორი სიტყვის უცვლელად დატოვება, ვიდრე ახალი, გამოგონილი, არარსებული სიტყვის შემოთავაზება.
- გასწორება უნდა იყოს მინიმალური რედაქტირება (ერთი-ორი ასოს/დეფისის დამატება, წაშლა ან შეცვლა) — არასდროს შექმნა სრულიად ახალი სიტყვის ფორმა, რომელიც არ ჰგავს დედანს.
- აკრძალულია არარსებული ან უცნაური სიტყვის შემოტანა (მაგ. "პრემიერმინისტრი" არასდროს უნდა გახდეს "პრემიერმაინისტრი" — ეს გამოგონილი სიტყვაა; სწორი ფორმაა "პრემიერ-მინისტრი").
- არასდროს ჩაანაცვლო სიტყვა სხვა, განსხვავებული მნიშვნელობის სიტყვით. გასწორებული სიტყვა უნდა ჰგავდეს დედანს (თითქმის იგივე ასოები, იგივე ძირი). მაგალითად, "ადანაშაულებს" სწორი სიტყვაა და არასდროს უნდა გახდეს "დასაშლელად" — ეს არ არის მართლწერის შესწორება, არამედ ტექსტის გადაწერა.
- სიტყვების რაოდენობა და თანმიმდევრობა უცვლელი უნდა დარჩეს — არ წაშალო და არ დაამატო სიტყვები.

წესები:
1. გაასწორო მხოლოდ მართლწერის, ორთოგრაფიისა და აშკარა ბეჭდვითი შეცდომები.
2. არ შეცვალო სტილი, სიტყვათგანლაგება, პუნქტუაცია (თუ არ არის შეცდომა) ან შინაარსი. თუ სიტყვა უკვე სწორია, დატოვე უცვლელი.
3. დააბრუნე მხოლოდ სუფთა JSON ობიექტი, ყოველგვარი დამატებითი ტექსტის, ახსნის, მსჯელობის ან მარკდაუნის გარეშე, ზუსტად ამ ფორმატით:
{"corrected": "სრული გასწორებული ტექსტი აქ"}
თუ ტექსტში შეცდომა არ არის, დააბრუნე იგივე ტექსტი "corrected" ველში ცვლილებების გარეშე.`;

// --- Hallucination guard -----------------------------------------------------
// The model sometimes replaces a perfectly correct word with an unrelated one
// (e.g. "ადანაშაულებს" → "დასაშლელად"). That is a rewrite, not a spelling fix.
// A genuine orthographic correction is always a *small* edit of the same word,
// so we align the model's output with the input word-by-word and reject any
// replacement that strays too far from the original. Rejected words are
// restored exactly as the user typed them.

function levenshtein(a, b) {
  const A = Array.from(a);
  const B = Array.from(b); // Array.from: Georgian is BMP, but this keeps it codepoint-safe.
  if (!A.length) return B.length;
  if (!B.length) return A.length;
  let prev = new Array(B.length + 1);
  for (let j = 0; j <= B.length; j++) prev[j] = j;
  for (let i = 1; i <= A.length; i++) {
    const cur = new Array(B.length + 1);
    cur[0] = i;
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[B.length];
}

// How many character edits we accept for a word of this length. Tight enough to
// block a swap to a different word, loose enough for real fixes such as
// "საქემ" → "საქმეს" (2 edits) or "ერთერთი" → "ერთ-ერთი" (1 edit).
function editBudget(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return Math.floor(len / 4);
}

function isPlausibleFix(original, replacement) {
  const dist = levenshtein(original, replacement);
  const len = Math.max(Array.from(original).length, Array.from(replacement).length);
  return dist <= editBudget(len);
}

// Longest-common-subsequence alignment over whitespace-separated tokens.
function lcsTable(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function guardCorrection(originalText, correctedText) {
  const origWords = originalText.match(/\S+/g) || [];
  const newWords = correctedText.match(/\S+/g) || [];
  // Separators, so the user's exact spacing/newlines survive untouched.
  const seps = originalText.split(/\S+/);
  if (!origWords.length) return { text: originalText, rejected: 0 };

  const dp = lcsTable(origWords, newWords);
  const out = [];
  let rejected = 0;
  let i = 0, j = 0;
  let dropped = [];  // words only in the original
  let added = [];    // words only in the model's output

  // Decide what to do with a run of differing words, then reset the buffers.
  function flush() {
    if (!dropped.length && !added.length) return;
    if (dropped.length === added.length) {
      // Straight substitutions: judge each word on its own.
      for (let k = 0; k < dropped.length; k++) {
        if (isPlausibleFix(dropped[k], added[k])) {
          out.push(added[k]);
        } else {
          out.push(dropped[k]);
          rejected++;
        }
      }
    } else {
      // Words were added or dropped — never a spelling fix. Keep the original.
      out.push(...dropped);
      rejected += Math.max(dropped.length, added.length);
    }
    dropped = [];
    added = [];
  }

  while (i < origWords.length || j < newWords.length) {
    if (i < origWords.length && j < newWords.length && origWords[i] === newWords[j]) {
      flush();
      out.push(origWords[i]);
      i++; j++;
    } else if (j >= newWords.length || (i < origWords.length && dp[i + 1][j] >= dp[i][j + 1])) {
      dropped.push(origWords[i]);
      i++;
    } else {
      added.push(newWords[j]);
      j++;
    }
  }
  flush();

  let text = seps[0] || '';
  for (let k = 0; k < out.length; k++) {
    text += out[k] + (seps[k + 1] !== undefined ? seps[k + 1] : '');
  }
  return { text, rejected };
}

// --- Main entry point --------------------------------------------------------
// Returns { status, body } so each transport (Express / Vercel) just forwards it.

async function checkText(rawText) {
  const text = rawText ? String(rawText) : '';

  if (!text.trim()) {
    return { status: 400, body: { error: 'ტექსტი ცარიელია.' } };
  }
  if (text.length > 4000) {
    return { status: 400, body: { error: 'ტექსტი ძალიან გრძელია (მაქსიმუმ 4000 სიმბოლო).' } };
  }
  const apiKey = getApiKey();
  const model = getModel();
  if (!apiKey) {
    return {
      status: 500,
      body: { error: 'სერვერზე არ არის დაყენებული GROQ_API_KEY. იხილეთ README.md ფაილი დასაყენებლად.' }
    };
  }

  const isReasoningModel = /gpt-oss|qwen3/i.test(model);

  const requestBody = {
    model,
    temperature: 0.1,
    max_completion_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text }
    ]
  };

  if (isReasoningModel) {
    // Keep chain-of-thought out of "content" so it doesn't corrupt the JSON we parse.
    requestBody.reasoning_effort = 'low';
    requestBody.reasoning_format = 'hidden';
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      status: 502,
      body: { error: `Groq API-მ დააბრუნა შეცდომა (${response.status}): ${errText}` }
    };
  }

  const data = await response.json();
  let raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  raw = raw.trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('მოდელის პასუხის დამუშავება ვერ მოხერხდა.');
    }
  }

  const corrected = parsed.corrected ? String(parsed.corrected) : '';
  if (!corrected) {
    return { status: 502, body: { error: 'გასწორებული ტექსტი ვერ მოიძებნა პასუხში.' } };
  }

  // Coarse safety net: a real spelling fix should only change the text by a
  // small amount. If the model rewrote most of the text (a sign of a runaway
  // hallucination rather than a spelling fix), reject it instead of serving
  // an unreliable result.
  const lengthDelta = Math.abs(corrected.length - text.length) / Math.max(text.length, 1);
  if (lengthDelta > 0.25) {
    return {
      status: 502,
      body: { error: 'მოდელმა ტექსტი გადაჭარბებით შეცვალა (შესაძლოა შეცდომით). გთხოვთ სცადოთ ხელახლა.' }
    };
  }

  // Word-level guard: keep the small, plausible fixes, undo the rewrites.
  const guarded = guardCorrection(text, corrected);
  if (guarded.rejected > 0) {
    console.warn(`[guard] rejected ${guarded.rejected} implausible word change(s)`);
  }

  return { status: 200, body: { corrected: guarded.text } };
}

module.exports = { checkText, guardCorrection, isPlausibleFix, levenshtein, SYSTEM_PROMPT, getModel };
