const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, imageUrl, duration } = req.body;
    const falKey = process.env.FAL_API_KEY;

    if (!falKey) throw new Error('FAL_API_KEY not configured');
    if (!imageUrl) throw new Error('No image URL provided');

    let finalImageUrl = imageUrl;

    // If base64, upload to fal storage first
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      const mimeType = imageUrl.split(';')[0].split(':')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const form = new FormData();
      form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: mimeType
      });

      const uploadRes = await fetch('https://rest.fal.ai/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          ...form.getHeaders()
        },
        body: form
      });

      const uploadText = await uploadRes.text();
      let uploadData;
      try { uploadData = JSON.parse(uploadText); }
      catch(e) { throw new Error('Upload parse failed: ' + uploadText.slice(0, 200)); }

      if (!uploadData.url) throw new Error('No URL from upload: ' + JSON.stringify(uploadData));
      finalImageUrl = uploadData.url;
    }

    const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        image_url: finalImageUrl,
        duration: String(duration || '10'),
        negative_prompt: 'blur, distortion, watermark, low quality'
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { throw new Error('Parse failed: ' + text.slice(0, 300)); }

    if (!response.ok) throw new Error(data.detail || data.message || data.error || text.slice(0,200));
    if (!data.request_id) throw new Error('No request_id: ' + JSON.stringify(data).slice(0,200));

    return res.json({ requestId: data.request_id });

  } catch(err) {
    console.error('Animate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
