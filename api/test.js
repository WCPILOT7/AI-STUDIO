const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const falKey = process.env.FAL_API_KEY;
  
  if (!falKey) return res.json({ error: 'FAL_API_KEY not found', keys: Object.keys(process.env).filter(k => k.includes('FAL')) });

  try {
    const response = await fetch('https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'She slowly turns toward camera',
        image_url: 'https://storage.googleapis.com/falserverless/kling/kling_input.jpeg',
        duration: '5'
      })
    });

    const text = await response.text();
    
    return res.json({ 
      http_status: response.status,
      key_preview: falKey.slice(0, 12) + '...',
      first_50_chars: text.slice(0, 50),
      full_response: text.slice(0, 1000)
    });
  } catch(err) {
    return res.json({ error: err.message });
  }
};
