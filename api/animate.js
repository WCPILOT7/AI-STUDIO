const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_url, duration } = req.body;
    const falKey = process.env.FAL_API_KEY;

    if (!falKey) throw new Error('FAL_API_KEY not configured');
    if (!image_url) throw new Error('No image URL provided');

    // Submit to Kling
    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
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

    const submitText = await submitRes.text();
    let submitData;
    try { submitData = JSON.parse(submitText); }
    catch(e) { throw new Error('Submit failed: ' + submitText.slice(0, 200)); }
    if (!submitRes.ok) throw new Error(submitData.detail || submitData.message || 'Submission failed');
    if (!submitData.request_id) throw new Error('No request ID');

    const requestId = submitData.request_id;

    // Poll from backend
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 6000));
      
      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${falKey}` } }
      );
      
      const statusText = await statusRes.text();
      if (!statusText || statusText.trim() === '') continue;
      
      let statusData;
      try { statusData = JSON.parse(statusText); }
      catch(e) { continue; }

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${falKey}` } }
        );
        const result = JSON.parse(await resultRes.text());
        const videoUrl = result.video?.url || result.videos?.[0]?.url || null;
        return res.json({ url: videoUrl });
      }

      if (statusData.status === 'FAILED') throw new Error('Animation failed on fal.ai');
    }

    throw new Error('Animation timed out');

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
