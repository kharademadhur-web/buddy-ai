# 🚀 Buddy AI - Groq Integration

Buddy AI now uses **Groq** for ultra-fast AI processing! This provides sub-second response times and excellent conversation quality.

## ⚡ Why Groq?

- **Lightning Fast**: Sub-second response times
- **High Quality**: GPT-4 level responses with excellent instruction following
- **Generous Free Tier**: 30 requests/minute, perfect for your use case
- **No Credit Card Required**: Free forever for reasonable use
- **Perfect for E-commerce**: Handles multiple users with proper rate limiting

## 🔧 Setup Instructions

### 1. Get Your Groq API Key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up for free (no credit card needed)
3. Create a new API key
4. Copy the key (starts with `gsk_`)

### 2. Configure Environment

1. Copy the example environment file:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` file and add your API key:
   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   USER_DATA_PATH=data/user_profiles
   MAX_REQUESTS_PER_MINUTE=30
   ```

### 3. Install Dependencies

```powershell
# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
venv\Scripts\Activate.ps1

# Install requirements
pip install -r backend/requirements.txt
```

### 4. Test the Integration

```powershell
# Test Groq connection
cd backend
python test_groq.py
```

### 5. Start the Server

```powershell
# Use the automated startup script
.\start_groq_backend.ps1

# Or manually:
cd backend
python main.py
```

## 🌐 API Endpoints

### Health Check
```
GET /api/health
```
Check if Groq is connected and get rate limit status.

### Chat (Streaming)
```
POST /api/chat/stream
```
Real-time streaming responses like ChatGPT.

### Chat (Non-streaming)
```
POST /api/chat
```
Standard request-response format.

### Test Model
```
GET /api/test-model
```
Quick test to verify everything works.

## 🎯 Rate Limiting

- **Free Tier**: 30 requests/minute
- **Built-in Protection**: Automatic rate limiting prevents API overuse
- **User-friendly**: Shows wait times when limits are reached
- **Scalable**: Easy to adjust limits in `.env` file

## 📊 Performance for calistalife.com

### Speed Comparison:
- **Self-hosted**: 10-30 seconds
- **Groq API**: 0.5-2 seconds ⚡
- **Network overhead**: Minimal

### User Load Handling:
- **30 RPM** = ~1800 requests/hour during peak
- **Perfect for e-commerce** customer support
- **Rate limiting** protects your quota
- **Conversation memory** maintains context

### Deployment Benefits:
- **No server requirements** for AI processing
- **Consistent performance** regardless of hosting
- **Auto-scaling** with Groq's infrastructure
- **Global CDN** for fast responses worldwide

## 🔍 Monitoring

The health endpoint provides comprehensive monitoring:

```json
{
  "status": "healthy",
  "groq_connected": true,
  "model_name": "llama-3.1-70b-versatile",
  "rate_limit": {
    "max_requests": 30,
    "current_requests": 5,
    "can_make_request": true,
    "wait_time": 0.0
  },
  "conversations": 12,
  "timestamp": "2025-10-18T07:00:00Z"
}
```

## 🛠️ Troubleshooting

### Common Issues:

1. **"GROQ_API_KEY not set"**
   - Make sure your `.env` file has the correct API key
   - Key should start with `gsk_`

2. **"Rate limit exceeded"**
   - Wait for the specified time
   - Consider upgrading to Groq Pro for higher limits

3. **"Groq API not available"**
   - Check your internet connection
   - Verify API key is valid
   - Check Groq service status

4. **Slow responses**
   - This usually means network issues, Groq itself is very fast
   - Check your internet connection

## 📈 Scaling for Production

When deploying to calistalife.com:

1. **Monitor usage** via the health endpoint
2. **Set up logging** to track response times
3. **Consider Groq Pro** if you exceed free limits
4. **Implement user session management** for better conversation flow
5. **Add caching** for common questions

## 🎉 You're Ready!

Your Buddy AI is now powered by Groq and ready for deployment on calistalife.com! Enjoy lightning-fast AI responses that will delight your customers.

---

**Next Steps:**
1. Test the integration thoroughly
2. Deploy to your domain
3. Monitor performance and usage
4. Scale up as needed

Happy coding! 🚀