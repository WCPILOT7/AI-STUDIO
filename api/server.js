const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Generate image
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, aspect_ratio } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
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

    if (!response.ok) {
      return res.status(400).json({ error: data.detail || 'Generation failed' });
    }

    let imageUrl = null;
    if (data.output) {
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.urls?.get) {
      // Poll for result
      imageUrl = await pollPrediction(data.urls.get, key);
    }

    res.json({ url: imageUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Animate image to video
app.post('/api/animate', async (req, res) => {
  try {
    const { prompt, image_url, duration } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(
      'https://api.replicate.com/v1/models/klingai/kling-v2.1-standard-image2video/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            prompt,
            start_image: image_url,
            duration: duration || 10,
            cfg_scale: 0.5,
            negative_prompt: 'blur, distortion, watermark, low quality'
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.detail || 'Animation failed' });
    }

    const videoUrl = await pollPrediction(data.urls?.get || data.url, key);
    res.json({ url: videoUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Poll Replicate until done
async function pollPrediction(url, key, maxTries = 90) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded') {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }
    if (data.status === 'failed') {
      throw new Error(data.error || 'Prediction failed');
    }
  }
  throw new Error('Timed out');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
