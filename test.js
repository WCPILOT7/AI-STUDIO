const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const falKey = process.env.FAL_API_KEY;
  
  if (!falKey) return res.json({ error: 'FAL_API_KEY not found in env' });
  
  // Test a simple fal.ai call
  const testRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: 'test',
      image_url: 'https://v3.fal.media/files/panda/CSekH2UBpK0byk9wU7hug_output.mp4'
    })
  });

  const text = await testRes.text();
  return res.json({ 
    status: testRes.status,
    key_preview: falKey.slice(0, 8) + '...',
    response: text.slice(0, 500)
  });
};
