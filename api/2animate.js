const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_url, duration } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(
      'https://api.replicate.com/v1/models/klingai/kling-v2.1-standard-image2video/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            prompt,
            start_image: image_url,
            duration: duration || 10,
            cfg_scale: 0.5,
            negative_prompt: 'blur, distortion, watermark, low quality'
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.detail || 'Failed' });

    const url = await poll(data.urls?.get || data.url, key);
    return res.json({ url });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

async function poll(url, key, max = 90) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    const d = await r.json();
    if (d.status === 'succeeded') return Array.isArray(d.output) ? d.output[0] : d.output;
    if (d.status === 'failed') throw new Error(d.error || 'Failed');
  }
  throw new Error('Timed out');
}
