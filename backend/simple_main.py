from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import time
import os
from datetime import datetime
import random
from user_memory import UserMemory
from topic_handlers import (TopicHandler, MathHandler, EmotionalHandler, 
                          DecisionHandler, KnowledgeHandler, RandomHandler)

# Initialize FastAPI
app = FastAPI(title="Buddy AI - Ultimate Intelligent Companion", version="2.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Memory System
memory = UserMemory()

# Data models
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    use_voice: bool = False
    context: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    response: str
    emotion: str
    sentiment: float
    confidence: float
    response_time: float
    timestamp: str

# Ultimate emotion detection system
def analyze_emotion_and_context(text: str) -> dict:
    """Enhanced emotion detection with context awareness"""
    text_lower = text.lower()
    
    # Joy/happiness words (expanded)
    joy_words = ["happy", "joy", "great", "awesome", "wonderful", "amazing", "excited", 
                 "fantastic", "excellent", "brilliant", "love", "perfect", "thrilled",
                 "delighted", "cheerful", "optimistic", "pleased", "glad", "ecstatic",
                 "euphoric", "elated", "blissful", "overjoyed"]
    joy_score = sum(2 if word in text_lower else 0 for word in joy_words)
    
    # Sadness words (expanded)
    sad_words = ["sad", "depressed", "down", "upset", "crying", "tears", "miserable",
                 "heartbroken", "disappointed", "gloomy", "melancholy", "sorrow", 
                 "grief", "despair", "blue", "lonely", "devastated", "crushed"]
    sad_score = sum(2 if word in text_lower else 0 for word in sad_words)
    
    # Anger words (expanded)
    anger_words = ["angry", "mad", "furious", "annoyed", "frustrated", "irritated",
                   "rage", "outraged", "livid", "pissed", "infuriated", "agitated",
                   "hostile", "resentful", "bitter"]
    anger_score = sum(2 if word in text_lower else 0 for word in anger_words)
    
    # Fear/anxiety words (expanded)
    fear_words = ["scared", "afraid", "worried", "anxious", "nervous", "panic", 
                  "terrified", "frightened", "stress", "stressed", "overwhelmed", 
                  "tense", "paranoid", "apprehensive", "uneasy"]
    fear_score = sum(2 if word in text_lower else 0 for word in fear_words)
    
    # Surprise words
    surprise_words = ["surprised", "shocked", "amazed", "astonished", "stunned", 
                     "wow", "incredible", "unbelievable", "mind-blown"]
    surprise_score = sum(1 if word in text_lower else 0 for word in surprise_words)
    
    # Determine dominant emotion
    scores = {
        "joy": joy_score,
        "sadness": sad_score, 
        "anger": anger_score,
        "fear": fear_score,
        "surprise": surprise_score
    }
    
    max_emotion = max(scores.keys(), key=lambda k: scores[k]) if max(scores.values()) > 0 else "neutral"
    max_score = scores.get(max_emotion, 0)
    
    # Calculate sentiment
    positive_score = joy_score + surprise_score
    negative_score = sad_score + anger_score + fear_score
    
    if positive_score > negative_score:
        sentiment = min(0.8, positive_score / 10)
    elif negative_score > positive_score:
        sentiment = -min(0.8, negative_score / 10)
    else:
        # Check for neutral positive/negative indicators
        positive_indicators = ["good", "nice", "okay", "fine", "well", "thanks", "please"]
        negative_indicators = ["bad", "not", "no", "never", "hate", "problem", "issue", "wrong"]
        
        pos_count = sum(1 for word in positive_indicators if word in text_lower)
        neg_count = sum(1 for word in negative_indicators if word in text_lower)
        
        if pos_count > neg_count:
            sentiment = 0.3
        elif neg_count > pos_count:
            sentiment = -0.3
        else:
            sentiment = 0.0
    
    confidence = min(0.95, max_score / 5) if max_score > 0 else 0.5
    
    return {
        "emotion": max_emotion,
        "sentiment": sentiment,
        "confidence": confidence,
        "emotion_scores": scores
    }

# Ultimate intelligent response generation
def generate_ultimate_response(message: str, emotion_data: dict, user_id: str = "default") -> str:
    """Generate the most intelligent, personalized response using all AI systems"""
    
    # Step 1: Update user memory and get profile
    user_profile = memory.update_from_message(user_id, message, emotion_data)
    
    # Step 2: Detect topic type
    topic = TopicHandler.detect_topic(message)
    
    # Step 3: Route to specialized handlers
    if topic == "math":
        response = MathHandler.solve_math(message)
        if "answer is" in response.lower() or "solution:" in response.lower():
            return response
    
    elif topic == "emotional":
        return EmotionalHandler.provide_support(message, emotion_data, user_profile)
    
    elif topic == "decision":
        return DecisionHandler.help_decide(message, user_profile)
    
    elif topic == "knowledge":
        return KnowledgeHandler.provide_knowledge(message)
    
    elif topic == "random":
        return RandomHandler.provide_fun_content(message)
    
    # Step 4: Generate personalized general response
    return _generate_personalized_response(message, emotion_data, user_profile)

def _generate_personalized_response(message: str, emotion_data: dict, user_profile: dict) -> str:
    """Generate personalized responses using user profile"""
    message_lower = message.lower()
    emotion = emotion_data.get("emotion", "neutral")
    
    # Get user info for personalization
    name = user_profile.get("memory_facts", {}).get("personal", {}).get("name", "")
    formality = user_profile.get("personality", {}).get("formality", 0.5)
    baseline_sentiment = user_profile.get("emotional_profile", {}).get("baseline_sentiment", 0.0)
    
    # Personalized greeting based on user style
    name_prefix = f"{name}, " if name else ""
    
    # Greeting responses (personalized)
    if any(word in message_lower for word in ["hello", "hi", "hey", "greetings", "good morning", "good afternoon"]):
        if emotion == "joy":
            return f"{name_prefix}Hello! I can sense your positive energy today. What's making you so happy?"
        elif emotion == "sadness":
            return f"{name_prefix}Hi there. I notice you might be going through something difficult. I'm here to listen and support you."
        elif emotion == "fear":
            return f"{name_prefix}Hello. I sense some worry in your message. You're safe here with me. What's on your mind?"
        elif formality > 0.7:
            return f"Good day{', ' + name if name else ''}! I'm Buddy, your AI companion. How may I assist you today?"
        elif formality < 0.3:
            return f"Hey{' ' + name if name else ''}! 👋 What's up? How are you doing today?"
        else:
            return f"Hello{' ' + name if name else ''}! I'm Buddy, your emotionally intelligent AI companion. How are you feeling today?"
    
    # About AI/capabilities (personalized based on user's technical level)
    elif any(phrase in message_lower for phrase in ["artificial intelligence", "ai", "what can you do", "capabilities"]):
        if user_profile.get("personality", {}).get("vocabulary_level") == "advanced":
            return f"I'm an advanced AI system utilizing natural language processing, emotion recognition, and personalized memory systems{', ' + name if name else ''}. I analyze your communication patterns, remember our conversations, and adapt my responses to your unique personality and needs. What specific aspect of AI interests you?"
        else:
            return f"I'm Buddy, your smart AI companion! I can understand your emotions, remember what we talk about, help solve problems, answer questions, and adapt to your communication style{', ' + name if name else ''}. I get smarter with every conversation we have. What would you like to explore together?"
    
    # Emotional support (highly personalized)
    elif emotion in ["sadness", "fear", "anger"]:
        support_response = f"{name_prefix}I can sense you're dealing with {emotion}."
        
        # Add context based on user's emotional history
        if baseline_sentiment < -0.3:
            support_response += " I've noticed this has been a challenging time for you lately. "
        
        if emotion == "sadness":
            support_response += "Your feelings are completely valid. I'm here to listen and support you through this. What's been weighing on your heart?"
        elif emotion == "fear":
            support_response += "Anxiety and worry can feel overwhelming. You're safe here with me. What specific concerns are troubling you?"
        elif emotion == "anger":
            support_response += "Your anger is understandable - something important to you has been affected. Take a deep breath. What happened?"
        
        return support_response
    
    # Work/career (personalized based on user's job if known)
    elif any(word in message_lower for word in ["work", "job", "career", "boss", "office"]):
        job = user_profile.get("memory_facts", {}).get("personal", {}).get("job", "")
        job_context = f" as a {job}" if job else ""
        
        if emotion == "fear" or "stress" in message_lower:
            return f"{name_prefix}Work stress{job_context} can be really overwhelming. I understand the pressure you're facing. What specific aspect is bothering you most? Let's work through this together."
        elif emotion == "anger":
            return f"{name_prefix}Work frustrations{job_context} are so valid. Something at work is really getting to you. Want to tell me what happened? I'm here to listen without judgment."
        else:
            return f"{name_prefix}How are things going with work{job_context}? Are you facing any particular challenges I can help you think through?"
    
    # Personal questions (use name and show memory)
    elif any(phrase in message_lower for phrase in ["how are you", "how do you feel"]):
        return f"Thank you for asking{', ' + name if name else ''}! I'm functioning well and genuinely happy to be chatting with you. I remember we've had {user_profile.get('statistics', {}).get('total_messages', 0)} conversations so far, and I'm always learning more about you. How are YOU feeling right now?"
    
    # Thank you (personalized)
    elif any(word in message_lower for word in ["thank", "thanks", "appreciate"]):
        if formality > 0.7:
            return f"You're most welcome{', ' + name if name else ''}! It's my pleasure to be of assistance. Is there anything else I can help you with today?"
        else:
            return f"You're so welcome{', ' + name if name else ''}! 😊 I genuinely love being helpful. That's what I'm here for. Anything else you want to chat about?"
    
    # About Buddy (show personality adaptation)
    elif any(phrase in message_lower for phrase in ["who are you", "about yourself"]):
        total_messages = user_profile.get('statistics', {}).get('total_messages', 0)
        return f"I'm Buddy, your emotionally intelligent AI companion{', ' + name if name else ''}! I'm designed to understand emotions, remember our conversations, and adapt to your unique communication style. We've chatted {total_messages} times, and I've learned that you {'prefer formal communication' if formality > 0.7 else 'like casual conversation' if formality < 0.3 else 'appreciate balanced dialogue'}. I'm here as your supportive friend who's always learning about you. What would you like to know?"
    
    # Complex/long messages (show understanding)
    elif len(message) > 50:
        return f"{name_prefix}You've shared a lot with me, and I can tell this is really important to you. This situation is clearly having a significant impact on your life. What aspect would you most like to focus on or explore further? I'm here to help you work through it."
    
    # Medium messages (personalized encouragement)
    elif len(message.split()) > 10:
        return f"{name_prefix}I can tell you've given this real thought. Your perspective is valuable and I appreciate you sharing it with me. How are you feeling about this situation overall?"
    
    # Default responses (adapt to user's communication style)
    else:
        if formality > 0.7:
            responses = [
                f"I would be delighted to hear more about that{', ' + name if name else ''}. Could you please elaborate?",
                f"That sounds quite interesting{', ' + name if name else ''}. What are your thoughts on this matter?"
            ]
        elif formality < 0.3:
            responses = [
                f"That's cool{', ' + name if name else ''}! Tell me more! 😊",
                f"Interesting! What's your take on it{', ' + name if name else ''}?"
            ]
        else:
            responses = [
                f"I'd love to hear more about that{', ' + name if name else ''}. What's your experience been like?",
                f"That's interesting{', ' + name if name else ''}. How are you feeling about it?"
            ]
        
        return random.choice(responses)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": True,
        "emotion_analyzer_loaded": True,
        "timestamp": datetime.now().isoformat(),
        "message": "Buddy AI is running perfectly!"
    }

# Enhanced memory endpoint
@app.get("/api/memory/{user_id}")
async def get_user_memory(user_id: str):
    """Get user's memory profile"""
    try:
        profile_summary = memory.get_user_summary(user_id)
        return profile_summary
    except Exception as e:
        return {"error": str(e)}

# Clear memory endpoint
@app.delete("/api/memory/{user_id}")
async def clear_user_memory(user_id: str):
    """Clear user's memory"""
    try:
        filepath = f"{memory.storage_path}/{user_id}.json"
        if os.path.exists(filepath):
            os.remove(filepath)
        return {"success": True, "message": "Memory cleared successfully"}
    except Exception as e:
        return {"error": str(e)}

# Main chat endpoint (ULTIMATE VERSION)
@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    start_time = time.time()
    
    try:
        # Get user ID
        user_id = chat_request.conversation_id or "default"
        
        # Analyze emotion with new system
        emotion_data = analyze_emotion_and_context(chat_request.message)
        
        # Generate ultimate intelligent response
        ai_response = generate_ultimate_response(
            message=chat_request.message,
            emotion_data=emotion_data, 
            user_id=user_id
        )
        
        # Calculate response time
        response_time = time.time() - start_time
        
        # Return structured response
        return ChatResponse(
            response=ai_response,
            emotion=emotion_data["emotion"],
            sentiment=emotion_data["sentiment"],
            confidence=emotion_data["confidence"],
            response_time=response_time,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        print(f"Chat error: {e}")
        # Enhanced fallback response
        return ChatResponse(
            response="I'm experiencing a small hiccup, but I'm still here for you! What would you like to talk about? I can help with math problems, emotional support, decisions, or just have a friendly chat.",
            emotion="neutral",
            sentiment=0.0,
            confidence=0.5,
            response_time=time.time() - start_time,
            timestamp=datetime.now().isoformat()
        )

# Run server
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Buddy AI Server...")
    print("Backend will be available at: http://localhost:8000")
    print("Frontend will be available at: http://localhost:8080")
    uvicorn.run(app, host="0.0.0.0", port=8000)