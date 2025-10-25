#!/usr/bin/env python3
"""
Test script for Groq integration
Verifies that the Groq engine works correctly
"""

import os
import asyncio
from groq_engine import GroqEngine

async def test_groq():
    """Test Groq engine functionality"""
    print("🧪 Testing Groq Integration...")
    
    # Check if API key is available
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("❌ GROQ_API_KEY environment variable not set")
        return False
    
    if api_key == "gsk_your_actual_key_here":
        print("❌ Please set your actual Groq API key in .env file")
        return False
    
    print(f"✓ API key found: {api_key[:10]}...")
    
    try:
        # Initialize engine
        engine = GroqEngine(max_requests_per_minute=30)
        print("✓ Groq engine initialized")
        
        # Test availability
        if engine.is_available():
            print("✓ Groq API is available")
        else:
            print("❌ Groq API not available")
            return False
        
        # Test non-streaming response
        print("\n📝 Testing non-streaming response...")
        response = engine.generate_response("Hello, how are you?", "test")
        print(f"Response: {response[:100]}...")
        
        # Test streaming response
        print("\n🌊 Testing streaming response...")
        print("Streaming: ", end="", flush=True)
        
        async for chunk in engine.stream_response("Tell me a short joke", "test"):
            if "data:" in chunk:
                import json
                try:
                    data = json.loads(chunk.split("data: ")[1].split("\n")[0])
                    if data.get("token"):
                        print(data["token"], end="", flush=True)
                    if data.get("done"):
                        break
                except:
                    pass
        
        print("\n✓ Streaming works!")
        
        # Test rate limiting info
        stats = engine.get_stats()
        print(f"\n📊 Stats:")
        print(f"   Model: {stats['model']}")
        print(f"   Rate limit: {stats['rate_limit']['current_requests']}/{stats['rate_limit']['max_requests']} requests")
        print(f"   Can make request: {stats['rate_limit']['can_make_request']}")
        
        print("\n🎉 All tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv("../.env")
    
    # Run test
    success = asyncio.run(test_groq())
    exit(0 if success else 1)