export default async function handler(req, res) {
  const { requestId } = req.query;
  if (!requestId) return res.status(400).json({ error: 'Missing requestId' });

  const statusRes = await fetch(
    `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${requestId}/status`,
    { headers: { 'Authorization': `Key ${process.env.FAL_API_KEY}` } }
  );

  const statusData = await statusRes.json();

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${requestId}`,
      { headers: { 'Authorization': `Key ${process.env.FAL_API_KEY}` } }
    );
    const result = await resultRes.json();
    return res.status(200).json({ status: 'COMPLETED', videoUrl: result?.video?.url });
  }

  return res.status(200).json({ status: statusData.status || 'IN_QUEUE' });
}
