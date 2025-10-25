#!/usr/bin/env python3
"""
Simple backend launcher for Buddy AI
"""
import uvicorn
from backend.main import app

if __name__ == "__main__":
    print("🚀 Starting Buddy AI backend...")
    print("📡 Connecting to Ollama model: buddy-ai-ultimate")
    print("🌐 Server will be available at: http://localhost:8000")
    print("📖 API docs at: http://localhost:8000/docs")
    
    uvicorn.run(
        "backend.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        reload_dirs=["backend"]
    )