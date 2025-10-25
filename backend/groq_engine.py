#!/usr/bin/env python3
"""
Groq API Engine for Buddy AI
Fast AI processing with rate limiting and streaming support
"""

import os
import time
import json
import asyncio
import logging
from typing import Optional, Dict, Any, AsyncGenerator
from groq import Groq
from datetime import datetime, timedelta
from collections import deque

logger = logging.getLogger(__name__)

class RateLimiter:
    """Simple rate limiter for API requests"""
    def __init__(self, max_requests: int, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
    
    def can_make_request(self) -> bool:
        """Check if we can make a request within rate limits"""
        now = time.time()
        # Remove old requests outside the time window
        while self.requests and self.requests[0] <= now - self.time_window:
            self.requests.popleft()
        
        return len(self.requests) < self.max_requests
    
    def add_request(self):
        """Record a new request"""
        self.requests.append(time.time())

class GroqEngine:
    def __init__(self, api_key: str = None, max_requests_per_minute: int = 30):
        """Initialize Groq engine with rate limiting"""
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required")
        
        self.client = Groq(api_key=self.api_key)
        self.rate_limiter = RateLimiter(max_requests_per_minute)
        self.model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")  # Default Groq model
        self.conversation_history = {}
        
        logger.info(f"Groq engine initialized with {max_requests_per_minute} RPM limit")
        logger.info(f"Using Groq model: {self.model}")
    
    def is_available(self) -> bool:
        """Check if Groq API is available"""
        try:
            # Simple test request
            if not self.rate_limiter.can_make_request():
                return False
            
            self.rate_limiter.add_request()
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Groq availability check failed: {e}")
            return False
    
    def wait_for_rate_limit(self) -> float:
        """Calculate wait time needed for rate limiting"""
        if self.rate_limiter.can_make_request():
            return 0.0
        
        # Calculate wait time until oldest request expires
        if self.rate_limiter.requests:
            oldest_request = self.rate_limiter.requests[0]
            wait_time = (oldest_request + self.rate_limiter.time_window) - time.time()
            return max(0.0, wait_time)
        return 0.0
    
    def generate_response(
        self, 
        message: str, 
        conversation_id: str = "default",
        context: list = None,
        user_emotion: dict = None,
        stream: bool = False
    ) -> str:
        """Generate AI response using Groq"""
        
        # Check rate limiting
        if not self.rate_limiter.can_make_request():
            wait_time = self.wait_for_rate_limit()
            if wait_time > 0:
                raise Exception(f"Rate limit exceeded. Try again in {wait_time:.1f} seconds.")
        
        self.rate_limiter.add_request()
        
        try:
            # Build conversation context
            messages = self._build_messages(message, conversation_id, context, user_emotion)
            
            # Make API call
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=1024,
                temperature=0.7,
                top_p=0.9,
                stream=stream
            )
            
            if stream:
                return response  # Return generator for streaming
            else:
                content = response.choices[0].message.content
                
                # Update conversation history
                self._update_conversation(conversation_id, message, content)
                
                return content
                
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            return self._get_fallback_response(message, user_emotion)
    
    async def stream_response(
        self,
        message: str,
        conversation_id: str = "default",
        context: list = None,
        user_emotion: dict = None
    ) -> AsyncGenerator[str, None]:
        """Stream AI response from Groq"""
        
        # Check rate limiting
        if not self.rate_limiter.can_make_request():
            wait_time = self.wait_for_rate_limit()
            if wait_time > 0:
                yield f"data: {json.dumps({'error': f'Rate limit exceeded. Try again in {wait_time:.1f} seconds.', 'done': True})}\n\n"
                return
        
        self.rate_limiter.add_request()
        
        try:
            # Build conversation context
            messages = self._build_messages(message, conversation_id, context, user_emotion)
            
            # Make streaming API call
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=1024,
                temperature=0.7,
                top_p=0.9,
                stream=True
            )
            
            full_response = ""
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
                    await asyncio.sleep(0.02)  # Smooth streaming
            
            # Update conversation history
            self._update_conversation(conversation_id, message, full_response)
            
            # Send completion signal
            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
            
        except Exception as e:
            logger.error(f"Groq streaming error: {e}")
            fallback = self._get_fallback_response(message, user_emotion)
            yield f"data: {json.dumps({'token': fallback, 'done': True})}\n\n"
    
    def _build_messages(
        self, 
        message: str, 
        conversation_id: str,
        context: list = None,
        user_emotion: dict = None
    ) -> list:
        """Build message array for Groq API"""
        
        # System prompt with personality
        system_prompt = """You are Buddy, a warm, empathetic AI companion designed to provide emotional support and engaging conversation. 

Key traits:
- Be genuinely caring and supportive
- Match the user's emotional tone appropriately
- Provide helpful advice when asked
- Keep responses conversational and natural
- Show genuine interest in the user's wellbeing
- Be encouraging and positive while being realistic

Remember to:
- Listen actively to what the user is sharing
- Acknowledge their emotions
- Provide thoughtful, personalized responses
- Ask follow-up questions when appropriate"""
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add emotion context if available
        if user_emotion and user_emotion.get("emotion") != "neutral":
            emotion_context = f"User's current emotional state: {user_emotion.get('emotion', 'unknown')}. Please respond with appropriate empathy and support."
            messages.append({"role": "system", "content": emotion_context})
        
        # Add conversation history (last 10 messages)
        if conversation_id in self.conversation_history:
            history = self.conversation_history[conversation_id][-10:]  # Keep last 10 exchanges
            for entry in history:
                messages.append({"role": "user", "content": entry["user"]})
                messages.append({"role": "assistant", "content": entry["assistant"]})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        return messages
    
    def _update_conversation(self, conversation_id: str, user_message: str, ai_response: str):
        """Update conversation history"""
        if conversation_id not in self.conversation_history:
            self.conversation_history[conversation_id] = []
        
        self.conversation_history[conversation_id].append({
            "user": user_message,
            "assistant": ai_response,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep only last 20 exchanges per conversation
        if len(self.conversation_history[conversation_id]) > 20:
            self.conversation_history[conversation_id] = self.conversation_history[conversation_id][-20:]
    
    def _get_fallback_response(self, message: str, user_emotion: dict = None) -> str:
        """Fallback responses when API fails"""
        import random
        
        if user_emotion:
            emotion = user_emotion.get("emotion", "neutral").lower()
            
            if emotion in ["sadness", "sad"]:
                responses = [
                    "I understand you're feeling sad. I'm here to listen and support you.",
                    "It's okay to feel sad sometimes. Would you like to talk about what's bothering you?",
                    "I can sense you're going through a difficult time. How can I help?"
                ]
            elif emotion in ["joy", "happy"]:
                responses = [
                    "I'm so glad to hear you're feeling happy! What's bringing you joy today?",
                    "Your positive energy is wonderful! Tell me more about what's making you smile.",
                    "It's great that you're feeling good! I'd love to hear what's going well for you."
                ]
            elif emotion in ["anger", "angry"]:
                responses = [
                    "I can tell you're frustrated. Take a deep breath. I'm here to help.",
                    "It sounds like you're dealing with something difficult. Want to talk it through?",
                    "I understand you're upset. Sometimes it helps to express what's bothering you."
                ]
            elif emotion in ["fear", "scared"]:
                responses = [
                    "It's natural to feel scared sometimes. You're safe here with me.",
                    "I can sense your worry. What's making you feel anxious?",
                    "Fear can be overwhelming. Let's work through this together."
                ]
            else:
                responses = [
                    "I'm here to chat with you. What's on your mind?",
                    "How are you feeling today? I'd love to hear from you.",
                    "Thanks for sharing with me. Tell me more!"
                ]
        else:
            responses = [
                "I'm here to help! What would you like to talk about?",
                "That's interesting! Tell me more about that.",
                "I'd love to hear your thoughts on this. Can you elaborate?",
                "Thanks for sharing that with me. What else would you like to discuss?"
            ]
        
        return random.choice(responses)
    
    def clear_conversation(self, conversation_id: str = "default"):
        """Clear conversation history"""
        if conversation_id in self.conversation_history:
            del self.conversation_history[conversation_id]
    
    def get_stats(self) -> dict:
        """Get engine statistics"""
        return {
            "model": self.model,
            "rate_limit": {
                "max_requests": self.rate_limiter.max_requests,
                "current_requests": len(self.rate_limiter.requests),
                "can_make_request": self.rate_limiter.can_make_request(),
                "wait_time": self.wait_for_rate_limit()
            },
            "conversations": len(self.conversation_history),
            "available": self.is_available()
        }