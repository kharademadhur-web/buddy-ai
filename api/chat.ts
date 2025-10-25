import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function analyzeEmotion(text: string) {
  const t = text.toLowerCase();
  if (["happy","joy","excited","great","awesome"].some(w => t.includes(w))) return { emotion: 'joy', sentiment: 0.8, confidence: 0.7 };
  if (["sad","upset","down","depressed"].some(w => t.includes(w))) return { emotion: 'sadness', sentiment: 0.2, confidence: 0.7 };
  if (["angry","mad","furious","annoyed"].some(w => t.includes(w))) return { emotion: 'anger', sentiment: 0.1, confidence: 0.7 };
  if (["worried","anxious","stressed","nervous"].some(w => t.includes(w))) return { emotion: 'fear', sentiment: 0.3, confidence: 0.7 };
  return { emotion: 'neutral', sentiment: 0.5, confidence: 0.6 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { message, conversation_id } = req.body || {};
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are Buddy, a helpful, empathetic AI companion.' },
        { role: 'user', content: message }
      ],
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9
    });

    const content = completion.choices?.[0]?.message?.content || "I'm here to help!";
    const emo = analyzeEmotion(content);

    res.status(200).json({
      response: content,
      emotion: emo.emotion,
      sentiment: emo.sentiment,
      confidence: emo.confidence,
      response_time: 0,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
