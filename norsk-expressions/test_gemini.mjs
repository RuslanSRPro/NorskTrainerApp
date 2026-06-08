const key = process.env.GEMINI_API_KEY;
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    contents: [{parts: [{text: 'Return JSON array of 5 Norwegian expressions with fields lemma, meaning_en, cefr only. No examples.'}]}],
    generationConfig: {maxOutputTokens: 500, responseMimeType: 'application/json'}
  })
});
const d = await res.json();
const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
console.log('LENGTH:', text.length);
console.log('TEXT:', text.slice(0, 500));
