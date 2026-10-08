const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// Proxies chat requests to Gemini using a key that only ever lives on
// the server (Render environment variable), never sent to the browser.
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  const { systemPrompt, contents } = req.body || {};
  if (!Array.isArray(contents)) {
    return res.status(400).json({ error: 'Missing contents.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt || '' }] },
          contents,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini request failed.' });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const answer = parts.map(p => p.text || '').join('').trim() || '(no response)';
    res.json({ answer });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to reach Gemini.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Helper server listening on ${PORT}`));
