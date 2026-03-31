const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_url, duration } = req.body;
    const falKey = process.env.FAL_API_KEY;

    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        image_url,
        duration: '10',
        aspect_ratio: '16:9'
      })
    });

    const submitText = await submitRes.text();
    console.log('Submit response:', submitText.slice(0, 500));

    let submitData;
    try { submitData = JSON.parse(submitText); }
    catch(e) { throw new Error('Submit parse failed: ' + submitText.slice(0, 300)); }

    if (!submitRes.ok) throw new Error(submitData.detail || submitData.message || JSON.stringify(submitData).slice(0, 200));

    const requestId = submitData.request_id;
    if (!requestId) throw new Error('No request_id returned: ' + JSON.stringify(submitData));

    const videoUrl = await pollFal('fal-ai/kling-video/v2.1/standard/image-to-video', requestId, falKey);
    return res.json({ url: videoUrl });

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

async function pollFal(endpoint, requestId, key, max = 90) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${key}` } }
      );
      const text = await res.text();
      if (!text || text.trim() === '') continue;

      let data;
      try { data = JSON.parse(text); }
      catch(e) { continue; }

      console.log('Poll status:', data.status);

      if (data.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/${endpoint}/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${key}` } }
        );
        const resultText = await resultRes.text();
        let result;
        try { result = JSON.parse(resultText); }
        catch(e) { throw new Error('Result parse failed: ' + resultText.slice(0, 200)); }
        return result.video?.url || result.videos?.[0]?.url || null;
      }
      if (data.status === 'FAILED') throw new Error(data.error || data.detail || 'Animation failed');
    } catch(e) {
      if (e.message.includes('failed') || e.message.includes('Failed')) throw e;
      continue;
    }
  }
  throw new Error('Animation timed out after 7.5 minutes');
}
