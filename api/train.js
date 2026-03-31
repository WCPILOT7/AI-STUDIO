const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, character_name } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    if (!images || images.length < 5) {
      return res.status(400).json({ error: 'Please upload at least 5 photos' });
    }

    const modelName = character_name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-lora';

    // Step 1 — Auto create the model repo on Replicate
    const createRes = await fetch('https://api.replicate.com/v1/models', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner: 'wcpilot7',
        name: modelName,
        description: `LoRA model for ${character_name} — AI Studio`,
        visibility: 'private',
        hardware: 'gpu-a40-large'
      })
    });

    // Model might already exist — that's fine, continue either way
    const createData = await createRes.json();
    if (!createRes.ok && !createData.detail?.includes('already exists')) {
      throw new Error(createData.detail || 'Failed to create model repo');
    }

    // Step 2 — Upload each photo to Replicate file storage
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

    // Step 3 — Start FLUX LoRA training
    const trainRes = await fetch('https://api.replicate.com/v1/trainings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destination: `wcpilot7/${modelName}`,
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

    const trainData = await trainRes.json();
    if (!trainRes.ok) return res.status(400).json({ error: trainData.detail || 'Training failed to start' });

    return res.json({
      training_id: trainData.id,
      status: trainData.status,
      model_name: modelName
    });

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
