from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import time
import requests
import json
from datetime import datetime

# Initialize FastAPI
app = FastAPI(title="Buddy AI API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    response: str
    emotion: str
    sentiment: float
    confidence: float
    response_time: float
    timestamp: str

# Ollama API configuration
OLLAMA_URL = "http://localhost:11434"
MODEL_NAME = "buddy-ai-ultimate"

def call_ollama(message: str) -> str:
    """Call Ollama API to get response from our custom model"""
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": message,
                "stream": False
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "Sorry, I couldn't generate a response.")
        else:
            return f"Error: Ollama API returned status {response.status_code}"
            
    except requests.exceptions.RequestException as e:
        return f"Error connecting to Ollama: {str(e)}"

def analyze_emotion(text: str) -> dict:
    """Simple emotion analysis"""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ["happy", "joy", "excited", "great", "awesome"]):
        return {"emotion": "joy", "sentiment": 0.8, "confidence": 0.7}
    elif any(word in text_lower for word in ["sad", "upset", "down", "depressed"]):
        return {"emotion": "sadness", "sentiment": 0.2, "confidence": 0.7}
    elif any(word in text_lower for word in ["angry", "mad", "furious", "annoyed"]):
        return {"emotion": "anger", "sentiment": 0.1, "confidence": 0.7}
    elif any(word in text_lower for word in ["worried", "anxious", "stressed", "nervous"]):
        return {"emotion": "fear", "sentiment": 0.3, "confidence": 0.7}
    else:
        return {"emotion": "neutral", "sentiment": 0.5, "confidence": 0.6}

# Health check endpoint
@app.get("/api/health")
async def health_check():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        ollama_healthy = response.status_code == 200
        
        return {
            "status": "healthy" if ollama_healthy else "unhealthy",
            "ollama_connected": ollama_healthy,
            "model_name": MODEL_NAME,
            "timestamp": datetime.now().isoformat()
        }
    except:
        return {
            "status": "unhealthy",
            "ollama_connected": False,
            "model_name": MODEL_NAME,
            "timestamp": datetime.now().isoformat()
        }

# Main chat endpoint
@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    start_time = time.time()
    
    try:
        # Get AI response from Ollama
        ai_response = call_ollama(chat_request.message)
        
        # Analyze emotion of the response
        emotion_data = analyze_emotion(ai_response)
        
        # Prepare response
        response_time = time.time() - start_time
        
        return ChatResponse(
            response=ai_response,
            emotion=emotion_data["emotion"],
            sentiment=emotion_data["sentiment"],
            confidence=emotion_data["confidence"],
            response_time=response_time,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Test endpoint
@app.get("/api/test-model")
async def test_model():
    try:
        response = call_ollama("Hello, are you working?")
        return {
            "status": "success",
            "response": response,
            "model": MODEL_NAME
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "model": MODEL_NAME
        }

# Run server
if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting Buddy AI backend...")
    print(f"📡 Connecting to Ollama model: {MODEL_NAME}")
    print(f"🌐 Server will be available at: http://localhost:8000")
    print(f"📖 API docs at: http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)