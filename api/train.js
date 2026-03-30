const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, character_name } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    if (!images || images.length < 5) {
      return res.status(400).json({ error: 'Please upload at least 5 photos' });
    }

    // Upload each image to Replicate's file storage
    const uploadedUrls = [];
    for (const base64img of images) {
      const base64Data = base64img.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = base64img.split(';')[0].split(':')[1] || 'image/jpeg';

      const uploadRes = await fetch('https://api.replicate.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': mimeType,
          'Content-Length': buffer.length
        },
        body: buffer
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.detail || 'File upload failed');
      uploadedUrls.push(uploadData.urls.get);
    }

    // Create a zip URL string Replicate can use
    // Start FLUX LoRA training with uploaded image URLs
    const response = await fetch('https://api.replicate.com/v1/trainings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destination: `wcpilot7/${character_name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-lora`,
        input: {
          input_images: uploadedUrls.join('\n'),
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
      status: data.status
    });

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
