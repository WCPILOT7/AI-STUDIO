const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const falKey = process.env.FAL_API_KEY;
    const { base64, mimeType } = req.body;

    if (!falKey) throw new Error('FAL_API_KEY not configured');
    if (!base64) throw new Error('No image data received');

    const buffer = Buffer.from(base64, 'base64');

    // Use fal's grpc-based upload endpoint
    const uploadRes = await fetch('https://fal.run/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': mimeType || 'image/jpeg',
      },
      body: buffer
    });

    const text = await uploadRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { throw new Error('Response: ' + text.slice(0, 300)); }

    if (!data.url) throw new Error('No URL: ' + JSON.stringify(data).slice(0, 200));
    return res.json({ url: data.url });

  } catch(err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
