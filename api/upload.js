const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const falKey = process.env.FAL_API_KEY;
    const { base64, mimeType } = req.body;
    
    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('file', buffer, { filename: 'image.jpg', contentType: mimeType });

    const uploadRes = await fetch('https://rest.fal.ai/storage/upload', {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, ...form.getHeaders() },
      body: form
    });

    const data = await uploadRes.json();
    return res.json({ url: data.url });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};
