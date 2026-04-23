const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_url, duration } = req.body;
    const falKey = process.env.FAL_API_KEY;

    if (!falKey) throw new Error('FAL_API_KEY not configured');
    if (!image_url) throw new Error('No image URL provided');

    // Use synchronous fal.run endpoint instead of queue
    const response = await fetch('https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        image_url,
        duration: String(duration || '10'),
        negative_prompt: 'blur, distortion, watermark, low quality'
      })
    });

    const text = await response.text();
    console.log('Kling response status:', response.status);
    console.log('Kling response body:', text.slice(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { throw new Error('Parse failed: ' + text.slice(0, 300)); }

    if (!response.ok) throw new Error(data.detail || data.message || data.error || text.slice(0, 200));

    const videoUrl = data.video?.url || data.videos?.[0]?.url || null;
    if (!videoUrl) throw new Error('No video URL in response: ' + JSON.stringify(data).slice(0, 200));

    return res.json({ url: videoUrl });

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
