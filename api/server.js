const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, prompt, aspect_ratio, image_url, duration } = req.body;
  const key = process.env.REPLICATE_API_TOKEN;

  try {
    if (type === 'generate') {
      const r = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'wait' },
        body: JSON.stringify({ input: { prompt, aspect_ratio: aspect_ratio || '3:4', output_format: 'jpg', output_quality: 90, safety_tolerance: 2 } })
      });
      const data = await r.json();
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.json({ url });
    }

    if (type === 'animate') {
      const r = await fetch('https://api.replicate.com/v1/models/klingai/kling-v2.1-standard-image2video/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { prompt, start_image: image_url, duration: duration || 10, cfg_scale: 0.5 } })
      });
      const data = await r.json();
      // Poll for result
      let videoUrl = null;
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(data.urls.get, { headers: { 'Authorization': `Bearer ${key}` } });
        const result = await poll.json();
        if (result.status === 'succeeded') { videoUrl = Array.isArray(result.output) ? result.output[0] : result.output; break; }
        if (result.status === 'failed') throw new Error('Failed');
      }
      return res.json({ url: videoUrl });
    }

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
