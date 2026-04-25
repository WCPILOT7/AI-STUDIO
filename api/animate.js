export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageUrl, prompt, duration } = req.body;

  const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      duration: String(duration || '10'),
      aspect_ratio: '9:16'
    })
  });

  const data = await response.json();

  if (!data.request_id) {
    return res.status(500).json({ error: 'No request_id from fal', detail: data });
  }

  return res.status(200).json({ requestId: data.request_id });
}
