const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, aspect_ratio, reference_image, lora_model } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    let predictionUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions';
    let input = {
      prompt,
      aspect_ratio: aspect_ratio || '3:4',
      output_format: 'jpg',
      output_quality: 90,
      safety_tolerance: 2
    };

    if (lora_model) {
      input.extra_lora = lora_model;
      input.extra_lora_scale = 0.85;
    }

    if (reference_image && !lora_model) {
      // Use FLUX Redux for image-guided generation
      predictionUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions';
      input = {
        redux_image: reference_image,
        prompt,
        aspect_ratio: aspect_ratio || '3:4',
        output_format: 'jpg',
        output_quality: 90,
        guidance: 3.5,
        num_inference_steps: 28
      };
    }

    const response = await fetch(predictionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(400).json({ error: err.detail || `HTTP ${response.status}` });
    }

    const data = await response.json();

    let imageUrl = null;
    if (data.output) {
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.urls?.get) {
      imageUrl = await poll(data.urls.get, key);
    }

    return res.json({ url: imageUrl });

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

async function poll(url, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    const d = await r.json();
    if (d.status === 'succeeded') return Array.isArray(d.output) ? d.output[0] : d.output;
    if (d.status === 'failed') throw new Error(d.error || 'Failed');
  }
  throw new Error('Timed out');
}
