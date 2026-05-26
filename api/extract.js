export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageMime, apiKey } = req.body;

  if (!imageBase64 || !apiKey) {
    return res.status(400).json({ error: 'Missing imageBase64 or apiKey' });
  }

  const prompt = `You are reading a diesel common rail injector bench test results screen photo.
Extract ALL data and return ONLY a valid JSON object — no markdown, no backticks, no extra text.

JSON format:
{
  "part_number": "...",
  "serial_number": "...",
  "new_code": "...",
  "manufacturer": "...",
  "rows": [
    { "step": "Leak", "p_rail": "...", "pw": "...", "q_ref": "...", "q_real": "...", "bip": "...", "assess": "pass" }
  ]
}

For assess: "pass" = tick/checkmark, "fail" = cross/X or any fail indicator.
Typical steps: Leak, VL, VL(R), EM, LL, VE1, VE2. Use "" for missing fields.
Return ONLY the JSON object.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const raw = data.content.map(b => b.text || '').join('');
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
