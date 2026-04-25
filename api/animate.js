const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, imageUrl, duration } = req.body;
    const falKey = process.env.FAL_API_KEY;

    if (!falKey) throw new Error('FAL_API_KEY not configured');
    if (!imageUrl) throw new Error('No image URL provided');

    const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl,
        duration: String(duration || '10'),
        negative_prompt: 'blur, distortion, watermark, low quality'
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { throw new Error('Parse failed: ' + text.slice(0, 300)); }

    if (!response.ok) throw new Error(data.detail || data.message || data.error || text.slice(0, 200));
    if (!data.request_id) throw new Error('No request_id from fal: ' + JSON.stringify(data).slice(0, 200));

    return res.json({ requestId: data.request_id });

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
