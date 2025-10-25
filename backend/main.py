from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, AsyncGenerator
import time
import os
import json
import asyncio
import logging
from datetime import datetime
from backend.groq_engine import GroqEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI with professional metadata
app = FastAPI(
    title="Buddy AI - Professional Assistant API",
    description="Advanced personalized AI companion with streaming responses",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

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

# Initialize Groq AI engine
MAX_REQUESTS_PER_MINUTE = int(os.getenv("MAX_REQUESTS_PER_MINUTE", 30))
groq_engine = GroqEngine(max_requests_per_minute=MAX_REQUESTS_PER_MINUTE)

def call_groq(message: str, conversation_id: str = "default") -> str:
    """Call Groq API to get response from AI model (non-streaming)"""
    try:
        logger.info(f"Sending message to Groq: {message[:50]}...")
        response = groq_engine.generate_response(
            message=message,
            conversation_id=conversation_id
        )
        return response
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return f"I'm experiencing some technical difficulties. Please try again in a moment."

async def stream_groq_response(message: str, conversation_id: str = "default") -> AsyncGenerator[str, None]:
    """Stream response from Groq API word by word"""
    logger.info(f"Streaming response for: {message[:50]}...")
    
    async for chunk in groq_engine.stream_response(
        message=message,
        conversation_id=conversation_id
    ):
        yield chunk

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
        groq_stats = groq_engine.get_stats()
        groq_healthy = groq_stats["available"]
        
        return {
            "status": "healthy" if groq_healthy else "unhealthy",
            "groq_connected": groq_healthy,
            "model_name": groq_stats["model"],
            "rate_limit": groq_stats["rate_limit"],
            "conversations": groq_stats["conversations"],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "groq_connected": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Streaming chat endpoint (like ChatGPT)
@app.post("/api/chat/stream")
async def chat_stream(chat_request: ChatRequest):
    """Stream chat responses word by word like ChatGPT"""
    logger.info(f"Streaming chat request from user: {chat_request.conversation_id}")
    
    def generate():
        return stream_groq_response(
            chat_request.message, 
            chat_request.conversation_id or "default"
        )
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Main chat endpoint (non-streaming fallback)
@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    start_time = time.time()
    
    try:
        # Get AI response from Groq
        ai_response = call_groq(
            chat_request.message, 
            chat_request.conversation_id or "default"
        )
        
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
        response = call_groq("Hello, are you working?", "test")
        stats = groq_engine.get_stats()
        return {
            "status": "success",
            "response": response,
            "model": stats["model"],
            "rate_limit_status": stats["rate_limit"]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "model": "groq-llama"
        }

# Run server
if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting Buddy AI backend with Groq...")
    print(f"📡 Using Groq model: {groq_engine.model}")
    print(f"⚡ Rate limit: {MAX_REQUESTS_PER_MINUTE} requests/minute")
    print(f"🌐 Server will be available at: http://localhost:8000")
    print(f"📖 API docs at: http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
