#!/usr/bin/env python3
"""
Buddy AI - Local API Wrapper
Simple Python interface for Buddy AI running on Ollama
"""

import requests
import json
import time
from typing import Optional, Dict, Any

class BuddyAI:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "buddy-ai"):
        """
        Initialize Buddy AI client
        
        Args:
            base_url: Ollama server URL
            model: Model name (default: buddy-ai)
        """
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.conversation_history = []
    
    def is_available(self) -> bool:
        """Check if Ollama server is running"""
        try:
            response = requests.get(self.base_url, timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def chat(self, message: str, stream: bool = False) -> str:
        """
        Send a message to Buddy AI
        
        Args:
            message: User message
            stream: Whether to stream response (default: False)
            
        Returns:
            Buddy's response
        """
        if not self.is_available():
            raise ConnectionError("Ollama server is not running. Start it with: ollama serve")
        
        # Add to conversation history
        self.conversation_history.append({"role": "user", "content": message})
        
        # Prepare request
        data = {
            "model": self.model,
            "prompt": message,
            "stream": stream,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9
            }
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=data,
                stream=stream,
                timeout=60
            )
            response.raise_for_status()
            
            if stream:
                full_response = ""
                for line in response.iter_lines():
                    if line:
                        try:
                            json_line = json.loads(line)
                            if "response" in json_line:
                                chunk = json_line["response"]
                                full_response += chunk
                                print(chunk, end="", flush=True)
                        except json.JSONDecodeError:
                            continue
                print()  # New line after streaming
                buddy_response = full_response
            else:
                result = response.json()
                buddy_response = result.get("response", "")
            
            # Add to conversation history
            self.conversation_history.append({"role": "assistant", "content": buddy_response})
            
            return buddy_response
            
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Error communicating with Buddy AI: {e}")
    
    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
    
    def get_models(self) -> list:
        """Get list of available models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            return response.json().get("models", [])
        except:
            return []
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check"""
        status = {
            "ollama_running": self.is_available(),
            "model_available": False,
            "response_time": None
        }
        
        if status["ollama_running"]:
            models = self.get_models()
            model_names = [m["name"] for m in models]
            status["model_available"] = any(self.model in name for name in model_names)
            
            if status["model_available"]:
                start_time = time.time()
                try:
                    self.chat("Hi", stream=False)
                    status["response_time"] = time.time() - start_time
                except:
                    pass
        
        return status

def main():
    """Simple CLI interface"""
    print("🤖 Buddy AI - Local Chat Interface")
    print("Type 'quit', 'exit', or 'bye' to end the conversation")
    print("Type 'clear' to clear conversation history")
    print("Type 'health' to check system status")
    print("-" * 50)
    
    buddy = BuddyAI()
    
    # Health check
    health = buddy.health_check()
    if not health["ollama_running"]:
        print("❌ Ollama server not running. Please start it with: ollama serve")
        return
    
    if not health["model_available"]:
        print("❌ Buddy AI model not found. Please run setup first: ./setup-buddy.ps1")
        return
    
    print("✅ Buddy AI is ready!")
    if health["response_time"]:
        print(f"⚡ Response time: {health['response_time']:.2f}s")
    print()
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                print("👋 Goodbye! Take care!")
                break
            
            if user_input.lower() == 'clear':
                buddy.clear_history()
                print("🧹 Conversation history cleared!")
                continue
            
            if user_input.lower() == 'health':
                health = buddy.health_check()
                print(f"Status: {health}")
                continue
            
            if not user_input:
                continue
            
            print("Buddy: ", end="")
            buddy.chat(user_input, stream=True)
            print()
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye! Take care!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()