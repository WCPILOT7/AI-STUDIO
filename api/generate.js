const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, aspect_ratio, reference_image, lora_model } = req.body;
    const falKey = process.env.FAL_API_KEY;
    const repKey = process.env.REPLICATE_API_TOKEN;

    let imageUrl = null;

    if (reference_image && falKey) {
      // Upload image to fal storage
      const base64Data = reference_image.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const uploadRes = await fetch('https://fal.run/storage/upload', {
        method: 'POST',
        headers: {
  'Authorization': `Key ${falKey}`,
  'Accept': 'application/json',
  'Content-Type': 'image/jpeg',
  'Content-Length': String(buffer.length)
},
body: buffer
      });

      const uploadText = await uploadRes.text();
      let uploadData;
      try { uploadData = JSON.parse(uploadText); }
      catch(e) { throw new Error('fal upload failed: ' + uploadText.slice(0, 100)); }

      if (!uploadRes.ok) throw new Error('fal upload error: ' + (uploadData.detail || uploadText.slice(0, 100)));

      const imageStorageUrl = uploadData.access_url || uploadData.url || uploadData.file_url;
      if (!imageStorageUrl) throw new Error('No URL returned from fal upload: ' + JSON.stringify(uploadData));

      // Submit to instant-character
      const submitRes = await fetch('https://queue.fal.run/fal-ai/instant-character', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          image_url: imageStorageUrl,
          num_images: 1,
          guidance_scale: 7
        })
      });

      const submitText = await submitRes.text();
      let submitData;
      try { submitData = JSON.parse(submitText); }
      catch(e) { throw new Error('fal submit failed: ' + submitText.slice(0, 100)); }

      if (!submitRes.ok) throw new Error('fal submit error: ' + (submitData.detail || submitText.slice(0, 100)));

      const requestId = submitData.request_id;
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
