const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { prompt, aspect_ratio } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: aspect_ratio || '3:4',
            output_format: 'jpg',
            output_quality: 90,
            safety_tolerance: 2
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.detail || 'Failed' });

    let url = null;
    if (data.output) {
      url = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.urls?.get) {
      url = await poll(data.urls.get, key);
    }

    return res.json({ url });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

async function poll(url, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    const d = await r.json();
    if (d.status === 'succeeded') return Array.isArray(d.output) ? d.output[0] : d.output;
    if (d.status === 'failed') throw new Error(d.error || 'Failed');
  }
  throw new Error('Timed out');
}
