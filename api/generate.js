const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, aspect_ratio, reference_image, lora_model } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    let predictionUrl;
    let requestBody;

    if (lora_model) {
      // Use trained LoRA model if available
      predictionUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions';
      requestBody = {
        input: {
          prompt,
          aspect_ratio: aspect_ratio || '3:4',
          output_format: 'jpg',
          output_quality: 90,
          safety_tolerance: 2,
          extra_lora: lora_model,
          extra_lora_scale: 0.85
        }
      };
    } else if (reference_image) {
      // Use IP-Adapter for character consistency with reference image
      predictionUrl = 'https://api.replicate.com/v1/models/zsxkib/flux-pulid/predictions';
      requestBody = {
        input: {
          prompt,
          main_face_image: reference_image,
          aspect_ratio: aspect_ratio || '3:4',
          output_format: 'jpg',
          output_quality: 90,
          true_cfg: 4,
          id_weight: 1.0,
          num_steps: 20,
          start_step: 0,
          num_outputs: 1,
          guidance_scale: 4
        }
      };
    } else {
      // Standard FLUX generation
      predictionUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions';
      requestBody = {
        input: {
          prompt,
          aspect_ratio: aspect_ratio || '3:4',
          output_format: 'jpg',
          output_quality: 90,
          safety_tolerance: 2
        }
      };
    }

    const response = await fetch(predictionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify(requestBody)
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
