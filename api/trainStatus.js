const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { training_id } = req.body;
    const key = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(`https://api.replicate.com/v1/trainings/${training_id}`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.detail || 'Failed to get status' });

    let model_id = null;
    if (data.status === 'succeeded' && data.output) {
      model_id = data.output.version || data.output;
    }

    return res.json({
      status: data.status,
      model_id,
      error: data.error || null,
      logs: data.logs || null
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
