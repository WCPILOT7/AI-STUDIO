const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const requestId = req.query.requestId;
    const falKey = process.env.FAL_API_KEY;

    if (!requestId) throw new Error('No requestId provided');
    if (!falKey) throw new Error('FAL_API_KEY not configured');

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    );

    const text = await statusRes.text();
    if (!text || text.trim() === '') return res.json({ status: 'IN_QUEUE' });

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.json({ status: 'IN_QUEUE' }); }

    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${falKey}` } }
      );
      const resultText = await resultRes.text();
      let result;
      try { result = JSON.parse(resultText); }
      catch(e) { throw new Error('Result parse failed'); }
      const videoUrl = result.video?.url || result.videos?.[0]?.url || null;
      return res.json({ status: 'COMPLETED', videoUrl });
    }

    if (data.status === 'FAILED') return res.json({ status: 'FAILED', error: data.error || 'Failed' });

    return res.json({ status: data.status || 'IN_QUEUE' });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
