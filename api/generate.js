const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, aspect_ratio, reference_image } = req.body;
    const falKey = process.env.FAL_API_KEY;
    const repKey = process.env.REPLICATE_API_TOKEN;

    let imageUrl = null;

    if (reference_image && falKey) {
      // Send base64 directly to fal.ai — no upload needed
      const submitRes = await fetch('https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json'
        },
     body: JSON.stringify({
  prompt,
  image_urls: [reference_image],
  num_images: 1,
  image_size: 'portrait_4_3',
  enhance_prompt_mode: 'standard'
})
      });

      const submitText = await submitRes.text();
      let submitData;
      try { submitData = JSON.parse(submitText); }
      catch(e) { throw new Error('fal submit parse failed: ' + submitText.slice(0, 200)); }

      if (!submitRes.ok) throw new Error('fal error: ' + (submitData.detail || submitData.message || submitText.slice(0, 200)));

      const requestId = submitData.request_id;
      if (!requestId) throw new Error('No request_id from fal: ' + JSON.stringify(submitData));

      imageUrl = await pollFal('fal-ai/instant-character', requestId, falKey);

    } else {
      // Standard FLUX fallback
      const response = await fetch(
        'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${repKey}`,
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
      if (!response.ok) throw new Error(data.detail || 'Generation failed');
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      if (!imageUrl && data.urls?.get) imageUrl = await pollReplicate(data.urls.get, repKey);
    }

    return res.json({ url: imageUrl });

  } catch(err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

async function pollFal(endpoint, requestId, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${key}` } }
    );
    const data = await res.json();
    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${key}` } }
      );
      const result = await resultRes.json();
      return result.images?.[0]?.url || result.image?.url || null;
    }
    if (data.status === 'FAILED') throw new Error('fal generation failed');
  }
  throw new Error('fal timed out');
}

async function pollReplicate(url, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    const d = await r.json();
    if (d.status === 'succeeded') return Array.isArray(d.output) ? d.output[0] : d.output;
    if (d.status === 'failed') throw new Error(d.error || 'Failed');
  }
  throw new Error('Timed out');
}
