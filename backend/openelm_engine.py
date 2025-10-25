"""
OpenELM 1.1B AI Engine with Advanced Personalization
Optimized for quality responses and intelligent length control
"""

import torch
import json
import time
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import logging
from transformers import AutoTokenizer, AutoModelForCausalLM
import os
from dataclasses import dataclass, asdict
import pickle

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class UserProfile:
    """Comprehensive user profile for personalization"""
    user_id: str
    name: Optional[str] = None
    communication_style: str = "casual"  # casual, formal, technical, creative
    preferred_response_length: str = "medium"  # short, medium, long
    interests: List[str] = None
    emotional_patterns: Dict[str, int] = None
    values: List[str] = None
    decision_style: str = "balanced"  # analytical, intuitive, balanced
    last_emotion: Optional[str] = None
    conversation_history: List[Dict] = None
    created_at: datetime = None
    updated_at: datetime = None
    
    def __post_init__(self):
        if self.interests is None:
            self.interests = []
        if self.emotional_patterns is None:
            self.emotional_patterns = {}
        if self.values is None:
            self.values = []
        if self.conversation_history is None:
            self.conversation_history = []
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = datetime.now()

class ResponseLengthAnalyzer:
    """Determines optimal response length based on context"""
    
    SHORT_TRIGGERS = [
        "yes", "no", "thanks", "hello", "hi", "bye", "what's", "where's", 
        "when's", "how much", "what time", "quick", "briefly"
    ]
    
    LONG_TRIGGERS = [
        "explain", "help me understand", "tell me about", "how do i", 
        "what should i do", "i'm confused", "i need advice", "teach me",
        "walk me through", "i'm struggling", "complex", "detailed"
    ]
    
    MATH_PATTERNS = ["solve", "calculate", "equation", "formula", "+", "-", "*", "/", "="]
    
    @staticmethod
    def analyze_required_length(message: str, user_profile: UserProfile) -> str:
        """Determine if response should be short, medium, or long"""
        message_lower = message.lower()
        
        # Check user preference first
        if user_profile.preferred_response_length == "short":
            bias = -1
        elif user_profile.preferred_response_length == "long":
            bias = 1
        else:
            bias = 0
        
        # Analyze message content
        if any(trigger in message_lower for trigger in ResponseLengthAnalyzer.SHORT_TRIGGERS):
            return "short" if bias <= 0 else "medium"
        
        if any(trigger in message_lower for trigger in ResponseLengthAnalyzer.MATH_PATTERNS):
            return "short" if len(message) < 50 else "medium"
        
        if any(trigger in message_lower for trigger in ResponseLengthAnalyzer.LONG_TRIGGERS):
            return "long" if bias >= 0 else "medium"
        
        # Default based on message length and complexity
        if len(message) < 30:
            return "short"
        elif len(message) > 100 or "?" in message:
            return "medium" if bias == 0 else ("long" if bias > 0 else "short")
        
        return "medium"

class OpenELMPersonalizedEngine:
    """OpenELM 1.1B with advanced personalization capabilities"""
    
    def __init__(self, model_path: str = "apple/OpenELM-1_1B-Instruct"):
        self.model_path = model_path
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self.user_profiles: Dict[str, UserProfile] = {}
        self.profiles_file = "user_profiles.pkl"
        
        # Load user profiles if they exist
        self._load_user_profiles()
        
        # Initialize model
        self._load_model()
        
        # Emotion keywords for detection
        self.emotion_keywords = {
            "joy": ["happy", "excited", "great", "amazing", "wonderful", "fantastic"],
            "sadness": ["sad", "down", "depressed", "disappointed", "upset"],
            "anger": ["angry", "mad", "frustrated", "annoyed", "furious"],
            "fear": ["scared", "worried", "anxious", "nervous", "afraid"],
            "surprise": ["surprised", "shocked", "wow", "unbelievable"],
            "neutral": ["okay", "fine", "normal", "regular"]
        }
    
    def _load_model(self):
        """Load OpenELM model and tokenizer"""
        try:
            logger.info(f"Loading OpenELM model: {self.model_path}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32,
                device_map="auto" if self.device.type == "cuda" else None
            )
            
            # Add padding token if not present
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            logger.info("OpenELM model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading OpenELM model: {e}")
            raise
    
    def _load_user_profiles(self):
        """Load user profiles from disk"""
        try:
            if os.path.exists(self.profiles_file):
                with open(self.profiles_file, 'rb') as f:
                    self.user_profiles = pickle.load(f)
                logger.info(f"Loaded {len(self.user_profiles)} user profiles")
        except Exception as e:
            logger.error(f"Error loading user profiles: {e}")
            self.user_profiles = {}
    
    def _save_user_profiles(self):
        """Save user profiles to disk"""
        try:
            with open(self.profiles_file, 'wb') as f:
                pickle.dump(self.user_profiles, f)
        except Exception as e:
            logger.error(f"Error saving user profiles: {e}")
    
    def _detect_emotion(self, text: str) -> str:
        """Simple emotion detection based on keywords"""
        text_lower = text.lower()
        emotion_scores = {}
        
        for emotion, keywords in self.emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                emotion_scores[emotion] = score
        
        if emotion_scores:
            return max(emotion_scores.items(), key=lambda x: x[1])[0]
        return "neutral"
    
    def _update_user_profile(self, user_id: str, message: str, emotion: str):
        """Update user profile based on conversation"""
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = UserProfile(user_id=user_id)
        
        profile = self.user_profiles[user_id]
        profile.last_emotion = emotion
        profile.updated_at = datetime.now()
        
        # Update emotional patterns
        if emotion in profile.emotional_patterns:
            profile.emotional_patterns[emotion] += 1
        else:
            profile.emotional_patterns[emotion] = 1
        
        # Add to conversation history (keep last 50 entries)
        profile.conversation_history.append({
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "emotion": emotion
        })
        
        # Keep only last 50 conversations
        if len(profile.conversation_history) > 50:
            profile.conversation_history = profile.conversation_history[-50:]
        
        self._save_user_profiles()
    
    def _build_personalized_prompt(self, message: str, user_profile: UserProfile, 
                                 required_length: str) -> str:
        """Build personalized prompt with user context"""
        
        # Base system prompt
        system_prompt = """You are an advanced personal AI companion. Provide helpful, personalized responses that match the user's communication style and needs."""
        
        # Add personalization context
        if user_profile.name:
            system_prompt += f" The user's name is {user_profile.name}."
        
        if user_profile.communication_style != "casual":
            system_prompt += f" Use a {user_profile.communication_style} communication style."
        
        if user_profile.interests:
            interests_str = ", ".join(user_profile.interests[:3])
            system_prompt += f" They are interested in: {interests_str}."
        
        # Add emotional context
        if user_profile.last_emotion and user_profile.last_emotion != "neutral":
            system_prompt += f" Consider their recent {user_profile.last_emotion} emotional state."
        
        # Add length guidance
        length_instructions = {
            "short": "Keep your response brief (1-2 sentences) unless more detail is essential.",
            "medium": "Provide a balanced response (3-5 sentences) with appropriate detail.",
            "long": "Give a comprehensive response (6+ sentences) with detailed explanations."
        }
        system_prompt += f" {length_instructions[required_length]}"
        
        # Recent context
        if user_profile.conversation_history:
            recent = user_profile.conversation_history[-2:]  # Last 2 conversations
            context = " Recent context: "
            for conv in recent:
                context += f"[{conv['emotion']}] {conv['message'][:50]}... "
            system_prompt += context
        
        return f"{system_prompt}\n\nUser: {message}\nAssistant:"
    
    def generate_response(self, message: str, user_id: str = "default", 
                         max_length: int = 200) -> Dict:
        """Generate personalized response using OpenELM"""
        start_time = time.time()
        
        try:
            # Detect emotion
            emotion = self._detect_emotion(message)
            
            # Get or create user profile
            if user_id not in self.user_profiles:
                self.user_profiles[user_id] = UserProfile(user_id=user_id)
            
            user_profile = self.user_profiles[user_id]
            
            # Determine required response length
            required_length = ResponseLengthAnalyzer.analyze_required_length(message, user_profile)
            
            # Adjust max_length based on required length
            length_limits = {"short": 50, "medium": 150, "long": 300}
            adjusted_max_length = min(max_length, length_limits[required_length])
            
            # Build personalized prompt
            prompt = self._build_personalized_prompt(message, user_profile, required_length)
            
            # Tokenize and generate
            inputs = self.tokenizer.encode(prompt, return_tensors="pt").to(self.device)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs,
                    max_length=inputs.shape[1] + adjusted_max_length,
                    temperature=0.7,
                    do_sample=True,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.1
                )
            
            # Decode response
            generated = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            response = generated.split("Assistant:")[-1].strip()
            
            # Clean up response
            response = self._clean_response(response)
            
            # Update user profile
            self._update_user_profile(user_id, message, emotion)
            
            # Calculate response time
            response_time = time.time() - start_time
            
            return {
                "response": response,
                "emotion": emotion,
                "user_id": user_id,
                "response_length": required_length,
                "personalized": True,
                "response_time": response_time,
                "model": "OpenELM-1.1B"
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return {
                "response": "I apologize, but I'm having trouble processing your request right now. Please try again.",
                "emotion": "neutral",
                "error": str(e),
                "response_time": time.time() - start_time
            }
    
    def _clean_response(self, response: str) -> str:
        """Clean and format the generated response"""
        # Remove any leftover prompt text
        if "User:" in response:
            response = response.split("User:")[0]
        
        # Remove excessive whitespace
        response = " ".join(response.split())
        
        # Ensure proper sentence ending
        if response and not response.endswith(('.', '!', '?')):
            response += "."
        
        return response.strip()
    
    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Get user profile information"""
        if user_id in self.user_profiles:
            profile = self.user_profiles[user_id]
            return {
                "user_id": profile.user_id,
                "name": profile.name,
                "communication_style": profile.communication_style,
                "preferred_response_length": profile.preferred_response_length,
                "interests": profile.interests,
                "emotional_patterns": profile.emotional_patterns,
                "last_emotion": profile.last_emotion,
                "conversation_count": len(profile.conversation_history),
                "created_at": profile.created_at.isoformat(),
                "updated_at": profile.updated_at.isoformat()
            }
        return None
    
    def update_user_preferences(self, user_id: str, updates: Dict):
        """Update user preferences"""
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = UserProfile(user_id=user_id)
        
        profile = self.user_profiles[user_id]
        
        # Update allowed fields
        allowed_fields = ["name", "communication_style", "preferred_response_length", "interests", "values"]
        for field in allowed_fields:
            if field in updates:
                setattr(profile, field, updates[field])
        
        profile.updated_at = datetime.now()
        self._save_user_profiles()

# Global instance for API use
openelm_engine = None

def get_openelm_engine():
    """Get or create OpenELM engine instance"""
    global openelm_engine
    if openelm_engine is None:
        openelm_engine = OpenELMPersonalizedEngine()
    return openelm_engine

if __name__ == "__main__":
    # Test the engine
    engine = OpenELMPersonalizedEngine()
    
    test_messages = [
        "Hi, how are you?",
        "I'm feeling really anxious about my job interview tomorrow. Can you help me prepare?",
        "Solve this equation: 2x + 5 = 15",
        "What's the capital of France?"
    ]
    
    for i, message in enumerate(test_messages):
        print(f"\n--- Test {i+1} ---")
        print(f"Input: {message}")
        
        result = engine.generate_response(message, user_id="test_user")
        
        print(f"Response: {result['response']}")
        print(f"Emotion: {result['emotion']}")
        print(f"Length: {result['response_length']}")
        print(f"Time: {result['response_time']:.2f}s")