export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.status(200).json({
    status: 'healthy',
    groq_connected: !!process.env.GROQ_API_KEY,
    model_name: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    timestamp: new Date().toISOString()
  });
}
