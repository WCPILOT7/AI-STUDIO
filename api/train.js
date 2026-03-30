const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, character_name } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    if (!images || images.length < 5) {
      return res.status(400).json({ error: 'Please upload at least 5 photos' });
    }

    // Start FLUX LoRA training on Replicate
    const response = await fetch('https://api.replicate.com/v1/trainings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destination: `wcpilot7/${character_name.toLowerCase().replace(/\s+/g, '-')}-lora`,
        input: {
          input_images: images,
          steps: 1000,
          lora_rank: 16,
          optimizer: 'adamw8bit',
          batch_size: 1,
          resolution: '512,768,1024',
          autocaption: true,
          trigger_word: character_name
        },
        version: 'ostris/flux-dev-lora-trainer:b6af14222e6bd9be257cbc1ea4afda3cd0503e1133083b9d1de0364d8568e6ef'
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.detail || 'Training failed to start' });

    return res.json({
      training_id: data.id,
      status: data.status,
      urls: data.urls
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
