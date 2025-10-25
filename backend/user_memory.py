import json
import os
from datetime import datetime
from collections import defaultdict
import hashlib
import re

class UserMemory:
    def __init__(self, storage_path="data/user_profiles"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        self.profiles = {}
    
    def get_user_id(self, identifier: str) -> str:
        """Generate consistent user ID"""
        return hashlib.md5(identifier.encode()).hexdigest()[:12]
    
    def load_profile(self, user_id: str) -> dict:
        """Load user profile from disk"""
        filepath = f"{self.storage_path}/{user_id}.json"
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return self._create_new_profile(user_id)
    
    def _create_new_profile(self, user_id: str) -> dict:
        """Create new user profile"""
        return {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "personality": {
                "communication_style": "neutral",  # casual, formal, technical
                "vocabulary_level": "medium",  # simple, medium, advanced
                "emoji_usage": 0.0,  # 0.0 to 1.0
                "humor_preference": 0.5,  # 0.0 to 1.0
                "formality": 0.5,  # 0.0 (casual) to 1.0 (formal)
                "verbosity": 0.5  # 0.0 (concise) to 1.0 (detailed)
            },
            "preferences": {
                "favorite_topics": [],
                "interests": [],
                "learning_goals": [],
                "time_zone": "UTC",
                "language": "en"
            },
            "conversation_history": [],
            "memory_facts": {
                "personal": {},  # Name, age, location, job, etc.
                "relationships": {},  # Family, friends, colleagues
                "goals": {},  # Short-term and long-term goals
                "challenges": {},  # Current problems/worries
                "achievements": {},  # Past successes
                "preferences": {}  # Likes, dislikes
            },
            "emotional_profile": {
                "baseline_sentiment": 0.0,
                "emotion_history": [],
                "stress_level": 0.0,
                "common_emotions": []
            },
            "communication_patterns": {
                "common_phrases": [],
                "sentence_structure": "medium",
                "question_frequency": 0.0,
                "average_message_length": 0
            },
            "decision_making": {
                "risk_tolerance": 0.5,  # 0.0 (cautious) to 1.0 (bold)
                "decision_speed": 0.5,  # 0.0 (slow) to 1.0 (fast)
                "analytical_vs_intuitive": 0.5,  # 0.0 (analytical) to 1.0 (intuitive)
                "past_decisions": []
            },
            "learning_style": {
                "visual": 0.33,
                "auditory": 0.33,
                "kinesthetic": 0.34,
                "preferred_explanation_style": "examples"  # examples, theory, practice
            },
            "statistics": {
                "total_messages": 0,
                "total_conversations": 0,
                "average_session_length": 0,
                "last_interaction": None,
                "topics_discussed": {}
            }
        }
    
    def save_profile(self, user_id: str, profile: dict):
        """Save user profile to disk"""
        filepath = f"{self.storage_path}/{user_id}.json"
        profile["statistics"]["last_interaction"] = datetime.now().isoformat()
        with open(filepath, 'w') as f:
            json.dump(profile, f, indent=2, default=str)
    
    def update_from_message(self, user_id: str, message: str, emotion: dict):
        """Learn from user message"""
        profile = self.load_profile(user_id)
        
        # Update statistics
        profile["statistics"]["total_messages"] += 1
        
        # Analyze communication style
        self._analyze_communication_style(profile, message)
        
        # Update emotional profile
        self._update_emotional_profile(profile, emotion)
        
        # Extract and store facts
        self._extract_facts(profile, message)
        
        # Store conversation
        profile["conversation_history"].append({
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "emotion": emotion
        })
        
        # Keep only last 100 messages
        if len(profile["conversation_history"]) > 100:
            profile["conversation_history"] = profile["conversation_history"][-100:]
        
        self.save_profile(user_id, profile)
        return profile
    
    def _analyze_communication_style(self, profile: dict, message: str):
        """Analyze how user communicates"""
        # Emoji usage
        emoji_count = sum(1 for char in message if ord(char) > 127000 or char in "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚😇🙂🙃😉😌😍🥰😘😗😙😚😇🙂🙃😌😝😜😛🤪🤨🧐🤓")
        profile["personality"]["emoji_usage"] = (
            profile["personality"]["emoji_usage"] * 0.9 + 
            (emoji_count / max(len(message), 1)) * 0.1
        )
        
        # Formality (detect formal words)
        formal_words = ["please", "thank", "kindly", "appreciate", "sincerely", "respectfully", "regards"]
        casual_words = ["hey", "yo", "sup", "gonna", "wanna", "yeah", "ok", "lol"]
        
        formal_count = sum(1 for word in formal_words if word in message.lower())
        casual_count = sum(1 for word in casual_words if word in message.lower())
        
        if formal_count > casual_count:
            profile["personality"]["formality"] = min(profile["personality"]["formality"] + 0.1, 1.0)
        elif casual_count > formal_count:
            profile["personality"]["formality"] = max(profile["personality"]["formality"] - 0.1, 0.0)
        
        # Verbosity
        word_count = len(message.split())
        if profile["communication_patterns"]["average_message_length"] == 0:
            profile["communication_patterns"]["average_message_length"] = word_count
        else:
            profile["communication_patterns"]["average_message_length"] = (
                profile["communication_patterns"]["average_message_length"] * 0.9 + 
                word_count * 0.1
            )
        
        # Update verbosity preference
        if word_count > 30:
            profile["personality"]["verbosity"] = min(profile["personality"]["verbosity"] + 0.05, 1.0)
        elif word_count < 10:
            profile["personality"]["verbosity"] = max(profile["personality"]["verbosity"] - 0.05, 0.0)
        
        # Question frequency
        is_question = message.strip().endswith('?')
        profile["communication_patterns"]["question_frequency"] = (
            profile["communication_patterns"]["question_frequency"] * 0.95 + 
            (1.0 if is_question else 0.0) * 0.05
        )
    
    def _update_emotional_profile(self, profile: dict, emotion: dict):
        """Track emotional patterns"""
        if emotion:
            profile["emotional_profile"]["emotion_history"].append({
                "timestamp": datetime.now().isoformat(),
                "emotion": emotion.get("emotion", "neutral"),
                "sentiment": emotion.get("sentiment", 0.0)
            })
            
            # Keep last 50 emotions
            if len(profile["emotional_profile"]["emotion_history"]) > 50:
                profile["emotional_profile"]["emotion_history"] = \
                    profile["emotional_profile"]["emotion_history"][-50:]
            
            # Calculate baseline sentiment
            recent_sentiments = [
                e["sentiment"] for e in 
                profile["emotional_profile"]["emotion_history"][-20:]
            ]
            if recent_sentiments:
                profile["emotional_profile"]["baseline_sentiment"] = \
                    sum(recent_sentiments) / len(recent_sentiments)
    
    def _extract_facts(self, profile: dict, message: str):
        """Extract personal information from message"""
        lower_msg = message.lower()
        
        # Name extraction
        name_patterns = [
            r"my name is (\w+)",
            r"i'm (\w+)",
            r"call me (\w+)",
            r"i am (\w+)"
        ]
        for pattern in name_patterns:
            match = re.search(pattern, lower_msg)
            if match and len(match.group(1)) > 2:  # Avoid single letters
                profile["memory_facts"]["personal"]["name"] = match.group(1).title()
        
        # Age extraction
        age_patterns = [
            r"i am (\d+) years old",
            r"i'm (\d+) years old",
            r"i am (\d+)",
            r"age (\d+)"
        ]
        for pattern in age_patterns:
            match = re.search(pattern, lower_msg)
            if match:
                age = int(match.group(1))
                if 5 <= age <= 120:  # Reasonable age range
                    profile["memory_facts"]["personal"]["age"] = age
        
        # Location extraction
        location_patterns = [
            r"i live in ([\w\s]+)",
            r"i'm from ([\w\s]+)",
            r"living in ([\w\s]+)",
            r"born in ([\w\s]+)"
        ]
        for pattern in location_patterns:
            match = re.search(pattern, lower_msg)
            if match:
                location = match.group(1).strip().title()
                if len(location.split()) <= 3:  # Reasonable location length
                    profile["memory_facts"]["personal"]["location"] = location
        
        # Job/Occupation
        job_patterns = [
            r"i work as (?:a |an )?([\w\s]+)",
            r"i'm (?:a |an )?([\w\s]+) by profession",
            r"my job is ([\w\s]+)",
            r"i am (?:a |an )?(teacher|doctor|engineer|student|programmer|developer|designer|manager)"
        ]
        for pattern in job_patterns:
            match = re.search(pattern, lower_msg)
            if match:
                job = match.group(1).strip().title()
                if len(job.split()) <= 4:
                    profile["memory_facts"]["personal"]["job"] = job
        
        # Goals extraction
        goal_keywords = ["want to", "hope to", "plan to", "goal is", "dream is", "trying to"]
        if any(keyword in lower_msg for keyword in goal_keywords):
            profile["memory_facts"]["goals"][datetime.now().isoformat()] = message
        
        # Challenges/Worries
        challenge_keywords = ["worried about", "anxious about", "stressed about", "problem with", "struggling with"]
        if any(keyword in lower_msg for keyword in challenge_keywords):
            profile["memory_facts"]["challenges"][datetime.now().isoformat()] = message
        
        # Achievements
        achievement_keywords = ["proud of", "accomplished", "achieved", "succeeded", "won", "graduated"]
        if any(keyword in lower_msg for keyword in achievement_keywords):
            profile["memory_facts"]["achievements"][datetime.now().isoformat()] = message
        
        # Preferences (likes/dislikes)
        if "i love" in lower_msg or "i really like" in lower_msg:
            profile["memory_facts"]["preferences"]["likes"] = profile["memory_facts"]["preferences"].get("likes", [])
            profile["memory_facts"]["preferences"]["likes"].append(message)
        elif "i hate" in lower_msg or "i dislike" in lower_msg:
            profile["memory_facts"]["preferences"]["dislikes"] = profile["memory_facts"]["preferences"].get("dislikes", [])
            profile["memory_facts"]["preferences"]["dislikes"].append(message)
    
    def get_context_for_response(self, user_id: str) -> str:
        """Generate context string for AI prompt"""
        profile = self.load_profile(user_id)
        
        context_parts = []
        
        # Personal info
        personal = profile["memory_facts"]["personal"]
        if personal:
            personal_info = []
            if "name" in personal:
                personal_info.append(f"Name: {personal['name']}")
            if "age" in personal:
                personal_info.append(f"Age: {personal['age']}")
            if "location" in personal:
                personal_info.append(f"Location: {personal['location']}")
            if "job" in personal:
                personal_info.append(f"Job: {personal['job']}")
            
            if personal_info:
                context_parts.append("User info: " + ", ".join(personal_info))
        
        # Communication style preferences
        style = profile["personality"]
        style_notes = []
        if style["formality"] > 0.7:
            style_notes.append("prefers formal communication")
        elif style["formality"] < 0.3:
            style_notes.append("prefers casual communication")
        
        if style["emoji_usage"] > 0.1:
            style_notes.append("uses emojis frequently")
        
        if style["verbosity"] > 0.7:
            style_notes.append("prefers detailed responses")
        elif style["verbosity"] < 0.3:
            style_notes.append("prefers concise responses")
        
        if style_notes:
            context_parts.append("Communication style: " + ", ".join(style_notes))
        
        # Emotional state
        baseline = profile["emotional_profile"]["baseline_sentiment"]
        if baseline > 0.3:
            context_parts.append("User generally has positive emotional state")
        elif baseline < -0.3:
            context_parts.append("User may be going through difficult times - be extra supportive")
        
        # Recent important facts
        recent_goals = list(profile["memory_facts"]["goals"].values())[-1:] if profile["memory_facts"]["goals"] else []
        recent_challenges = list(profile["memory_facts"]["challenges"].values())[-1:] if profile["memory_facts"]["challenges"] else []
        
        if recent_goals:
            context_parts.append(f"Current goal: {recent_goals[0]}")
        if recent_challenges:
            context_parts.append(f"Current challenge: {recent_challenges[0]}")
        
        # Conversation history (last 3 messages)
        recent_messages = profile["conversation_history"][-3:]
        if recent_messages:
            context_parts.append("Recent conversation:")
            for msg in recent_messages:
                context_parts.append(f"- User: {msg['message']}")
        
        return "\n".join(context_parts)
    
    def get_user_summary(self, user_id: str) -> dict:
        """Get a summary of user's profile for API"""
        profile = self.load_profile(user_id)
        return {
            "user_id": user_id,
            "name": profile["memory_facts"]["personal"].get("name", "Unknown"),
            "total_messages": profile["statistics"]["total_messages"],
            "personality": profile["personality"],
            "baseline_sentiment": profile["emotional_profile"]["baseline_sentiment"],
            "last_interaction": profile["statistics"]["last_interaction"],
            "memory_facts": {
                "personal": profile["memory_facts"]["personal"],
                "recent_goals": list(profile["memory_facts"]["goals"].values())[-3:],
                "recent_challenges": list(profile["memory_facts"]["challenges"].values())[-3:]
            }
        }