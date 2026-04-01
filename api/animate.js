const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_url, duration } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    if (!key) throw new Error('REPLICATE_API_TOKEN not configured');
    if (!image_url) throw new Error('No image URL provided');

    // Submit to Kling via Replicate
    const submitRes = await fetch('https://api.replicate.com/v1/models/klingai/kling-2.1-standard-image-to-video/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt,
          image: image_url,
          duration: duration || 10,
          cfg_scale: 0.5
        }
      })
    });

    const submitText = await submitRes.text();
    console.log('Replicate submit:', submitText.slice(0, 500));

    let submitData;
    try { submitData = JSON.parse(submitText); }
    catch(e) { throw new Error('Submit parse failed: ' + submitText.slice(0, 300)); }

    if (!submitRes.ok) throw new Error(submitData.detail || submitData.error || JSON.stringify(submitData).slice(0, 200));

    let videoUrl = null;
    if (submitData.status === 'succeeded') {
      videoUrl = Array.isArray(submitData.output) ? submitData.output[0] : submitData.output;
    } else if (submitData.urls?.get) {
      videoUrl = await pollReplicate(submitData.urls.get, key);
    }

    if (!videoUrl) throw new Error('No video URL returned');
    return res.json({ url: videoUrl });

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

async function pollReplicate(url, key, max = 90) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
      const text = await r.text();
      if (!text || text.trim() === '') continue;
      let d;
      try { d = JSON.parse(text); } catch(e) { continue; }
      if (d.status === 'succeeded') return Array.isArray(d.output) ? d.output[0] : d.output;
      if (d.status === 'failed') throw new Error(d.error || 'Animation failed');
    } catch(e) {
      if (e.message.includes('failed') || e.message.includes('Failed')) throw e;
      continue;
    }
  }
  throw new Error('Animation timed out');
}
