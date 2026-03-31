const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, mode, image_url, duration, aspect_ratio } = req.body;
    const falKey = process.env.FAL_API_KEY;

    let result = null;

    if (mode === 'text-to-video') {
      // Direct text to video via Kling
      const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/text-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            prompt,
            duration: duration === 5 ? '5' : '10',
            aspect_ratio: aspect_ratio || '9:16',
            negative_prompt: 'blur, distortion, watermark, low quality'
          }
        })
      });
      const submitText = await submitRes.text();
      let submitData;
      try { submitData = JSON.parse(submitText); } catch(e) { throw new Error('Submit failed: ' + submitText.slice(0,300)); }
      if (!submitRes.ok) throw new Error(submitData.detail || submitData.message || JSON.stringify(submitData).slice(0,200));
      const requestId = submitData.request_id;
      if (!requestId) throw new Error('No request_id: ' + JSON.stringify(submitData));
      result = await pollFal('fal-ai/kling-video/v2.1/standard/text-to-video', requestId, falKey);
      return res.json({ url: result, type: 'video' });

    } else if (mode === 'text-to-image') {
      // Generate scene image via Seedream
      const submitRes = await fetch('https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            prompt,
            num_images: 1,
            image_size: aspect_ratio === '9:16' ? 'portrait_16_9' : 'portrait_4_3',
            enhance_prompt_mode: 'standard'
          }
        })
      });
      const submitText = await submitRes.text();
      let submitData;
      try { submitData = JSON.parse(submitText); } catch(e) { throw new Error('Submit failed: ' + submitText.slice(0,300)); }
      if (!submitRes.ok) throw new Error(submitData.detail || submitData.message || JSON.stringify(submitData).slice(0,200));
      const requestId = submitData.request_id;
      if (!requestId) throw new Error('No request_id: ' + JSON.stringify(submitData));
      const imageUrl = await pollFalImage('fal-ai/bytedance/seedream/v4.5/text-to-image', requestId, falKey);
      return res.json({ url: imageUrl, type: 'image' });

    } else if (mode === 'image-to-video') {
      // Animate an existing scene image
      const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            prompt,
            image_url,
            duration: duration === 5 ? '5' : '10',
            negative_prompt: 'blur, distortion, watermark, low quality'
          }
        })
      });
      const submitText = await submitRes.text();
      let submitData;
      try { submitData = JSON.parse(submitText); } catch(e) { throw new Error('Submit failed: ' + submitText.slice(0,300)); }
      if (!submitRes.ok) throw new Error(submitData.detail || submitData.message || JSON.stringify(submitData).slice(0,200));
      const requestId = submitData.request_id;
      if (!requestId) throw new Error('No request_id: ' + JSON.stringify(submitData));
      result = await pollFal('fal-ai/kling-video/v2.1/standard/image-to-video', requestId, falKey);
      return res.json({ url: result, type: 'video' });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch(err) {
    console.error('Scene error:', err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

async function pollFal(endpoint, requestId, key, max = 90) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, { headers: { 'Authorization': `Key ${key}` } });
      const text = await res.text();
      if (!text || text.trim() === '') continue;
      let data;
      try { data = JSON.parse(text); } catch(e) { continue; }
      if (data.status === 'COMPLETED') {
        const resultRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, { headers: { 'Authorization': `Key ${key}` } });
        const result = JSON.parse(await resultRes.text());
        return result.video?.url || result.videos?.[0]?.url || null;
      }
      if (data.status === 'FAILED') throw new Error(data.error || 'Scene generation failed');
    } catch(e) {
      if (e.message.includes('failed') || e.message.includes('Failed')) throw e;
      continue;
    }
  }
  throw new Error('Scene timed out');
}

async function pollFalImage(endpoint, requestId, key, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, { headers: { 'Authorization': `Key ${key}` } });
      const text = await res.text();
      if (!text || text.trim() === '') continue;
      let data;
      try { data = JSON.parse(text); } catch(e) { continue; }
      if (data.status === 'COMPLETED') {
        const resultRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, { headers: { 'Authorization': `Key ${key}` } });
        const result = JSON.parse(await resultRes.text());
        return result.images?.[0]?.url || null;
      }
      if (data.status === 'FAILED') throw new Error('Image generation failed');
    } catch(e) {
      if (e.message.includes('failed') || e.message.includes('Failed')) throw e;
      continue;
    }
  }
  throw new Error('Image timed out');
}
