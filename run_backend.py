#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from backend.main import app
import uvicorn

if __name__ == "__main__":
    print("Starting Buddy AI backend (Groq) via uvicorn...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)