const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { request_id } = req.body;
    const falKey = process.env.FAL_API_KEY;

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${request_id}/status`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    );

    const text = await statusRes.text();
    if (!text || text.trim() === '') return res.json({ status: 'processing' });

    let data;
    try { data = JSON.parse(text); } 
    catch(e) { return res.json({ status: 'processing' }); }

    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${request_id}`,
        { headers: { 'Authorization': `Key ${falKey}` } }
      );
      const resultText = await resultRes.text();
      let result;
      try { result = JSON.parse(resultText); }
      catch(e) { throw new Error('Result parse failed'); }
      const videoUrl = result.video?.url || result.videos?.[0]?.url || null;
      return res.json({ status: 'completed', url: videoUrl });
    }

    if (data.status === 'FAILED') return res.json({ status: 'failed', error: data.error || 'Failed' });

    return res.json({ status: 'processing', queue_position: data.queue_position });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
