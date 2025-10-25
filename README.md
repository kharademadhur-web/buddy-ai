# 🤖 Buddy AI - Emotionally Intelligent Assistant

<div align="center">

![Buddy AI](https://img.shields.io/badge/AI-Phi--2-purple)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![React](https://img.shields.io/badge/react-18-cyan)
![License](https://img.shields.io/badge/license-MIT-green)

**Your private, emotionally intelligent AI companion that runs 100% locally**

[🚀 Quick Start](#quick-start) • [✨ Features](#features) • [📖 Documentation](#documentation) • [🤝 Contributing](#contributing)

</div>

---

## ✨ Features

### 🔒 **100% Private**
- All processing happens on your device
- No data sent to cloud servers
- No tracking, no subscriptions

### ❤️ **Emotionally Intelligent**
- Detects 6 emotions in real-time
- Sentiment analysis on every message
- Context-aware responses

### 🎤 **Voice Enabled**
- Speech-to-text input
- Natural text-to-speech output
- Hands-free interaction

### 🎨 **Beautiful UI**
- Modern, responsive design
- Dark/light mode
- Mobile-friendly interface

### ⚡ **Performance Optimized**
- Response caching (30min TTL)
- Rate limiting protection
- < 2 second response time

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10 or higher
- 4GB RAM minimum
- Windows/Mac/Linux

### Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/buddy-ai.git
cd buddy-ai

# Run startup script
# Windows:
scripts\start_web.bat

# Mac/Linux:
python scripts/start_web.py
```

**That's it!** Buddy AI will:
1. Create virtual environment
2. Install dependencies
3. Start backend server
4. Start frontend server
5. Open browser automatically

Visit: **http://localhost:8080**

---

## 📖 Documentation

### Project Structure
```
buddy-ai/
├── backend/          # FastAPI server
│   ├── main.py       # API endpoints
│   ├── ai_engine.py  # Phi-2 integration
│   └── emotion_analyzer.py
├── frontend/         # React web app
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── tests/            # Test suite
└── scripts/          # Utility scripts
```

### API Endpoints

#### POST /api/chat
Send a message to Buddy AI

**Request:**
```json
{
  "message": "Hello!",
  "conversation_id": "abc123",
  "context": []
}
```

**Response:**
```json
{
  "response": "Hi! How can I help?",
  "emotion": "joy",
  "sentiment": 0.85,
  "confidence": 0.92,
  "response_time": 1.23
}
```

#### GET /api/health
Check server status

---

## 🧪 Testing

```bash
# Run automated tests
python tests/test_web.py

# Run demo script
python scripts/demo_script.py
```

---

## 🌐 Deployment

### Local Development
```bash
python scripts/start_web.py
```

### Cloud Deployment (Render.com)
1. Push to GitHub
2. Connect to Render.com
3. Deploy using `render.yaml`
4. Done! ✅

---

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, Uvicorn
- **AI Models**: 
  - Microsoft Phi-2 (LLM)
  - DistilRoBERTa (Emotion)
  - DistilBERT (Sentiment)
- **Frontend**: React, Vanilla JS
- **Voice**: Web Speech API, pyttsx3

---

## 📊 Performance

- **Response Time**: < 2 seconds average
- **Emotion Accuracy**: 85%+
- **Memory Usage**: ~2GB
- **Concurrent Users**: 10+

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- Microsoft for Phi-2 model
- Hugging Face for Transformers
- FastAPI team
- React community

---

<div align="center">

**Made with ❤️ by [Your Name]**

[⭐ Star this repo](https://github.com/YOUR_USERNAME/buddy-ai) if you find it useful!

</div>