const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, aspect_ratio, reference_image, lora_model } = req.body;
    const falKey = process.env.FAL_API_KEY;
    const repKey = process.env.REPLICATE_API_TOKEN;

    let imageUrl = null;

    if (lora_model) {
      // Use Replicate FLUX with trained LoRA
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
              extra_lora: lora_model,
              extra_lora_scale: 0.85
            }
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'LoRA generation failed');
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      if (!imageUrl && data.urls?.get) imageUrl = await pollReplicate(data.urls.get, repKey);

    } else if (reference_image && falKey) {
      // Use fal.ai consistent character model
      const aspectMap = {
        '4:5': '4:5', '3:4': '3:4', '1:1': '1:1', '9:16': '9:16'
      };
      const falAspect = aspectMap[aspect_ratio] || '3:4';

      // Submit to fal.ai
      const submitRes = await fetch('https://queue.fal.run/fal-ai/consistent-character', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          subject_image_url: reference_image,
          num_images: 1,
          output_format: 'jpeg',
          aspect_ratio: falAspect
        })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.detail || submitData.error || 'fal.ai submission failed');

      // Poll fal.ai for result
      const requestId = submitData.request_id;
      imageUrl = await pollFal(requestId, falKey);

    } else {
      // Standard FLUX generation fallback
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
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

async function pollFal(requestId, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(
      `https://queue.fal.run/fal-ai/consistent-character/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${key}` } }
    );
    const data = await res.json();
    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/consistent-character/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${key}` } }
      );
      const result = await resultRes.json();
      return result.images?.[0]?.url || result.image?.url || null;
    }
    if (data.status === 'FAILED') throw new Error('fal.ai generation failed');
  }
  throw new Error('fal.ai timed out');
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
