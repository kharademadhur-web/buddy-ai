from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class BuddyAI:
    def __init__(self):
        self.model_name = "gpt2"  # Much smaller model that works on limited RAM
        self.model = None
        self.tokenizer = None
        self.load_model()
    
    def load_model(self):
        """Load GPT-2 model (smaller, more compatible)"""
        try:
            print("Loading GPT-2 model...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True
            )
            self.model.eval()
            print("✓ Model loaded successfully")
        except Exception as e:
            print(f"✗ Error loading model: {e}")
            # Fallback to a simple response system
            self.model = None
            self.tokenizer = None
            print("Using fallback response system")
    
    def is_loaded(self):
        return self.model is not None
    
    def generate_response(self, message: str, context: list = None, user_emotion: dict = None):
        """Generate AI response with context and emotion awareness"""
        if self.model is None or self.tokenizer is None:
            # Use fallback responses when model isn't available
            return self._get_fallback_response(message, user_emotion)
            
        try:
            # Build prompt with context
            prompt = self._build_prompt(message, context, user_emotion)
            
            # Tokenize
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256)
            
            # Generate
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs.input_ids,
                    max_new_tokens=50,  # Reduced for better performance
                    temperature=0.8,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            # Decode
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the new generated text
            response = response[len(prompt):].strip()
            
            return response if response else "I'm here to help! What would you like to talk about?"
            
        except Exception as e:
            print(f"Model error: {e}")
            return self._get_fallback_response(message, user_emotion)
    
    def _get_fallback_response(self, message: str, user_emotion: dict = None):
        """Generate responses when AI model isn't available"""
        import random
        
        # Emotion-aware responses
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
            # General responses based on message content
            message_lower = message.lower()
            if any(word in message_lower for word in ["hello", "hi", "hey", "greetings"]):
                responses = [
                    "Hello! I'm Buddy, your AI companion. How can I help you today?",
                    "Hi there! Great to meet you. What would you like to talk about?",
                    "Hey! I'm excited to chat with you. What's on your mind?"
                ]
            elif any(word in message_lower for word in ["help", "assist", "support"]):
                responses = [
                    "I'm here to help! What do you need assistance with?",
                    "Of course! I'd be happy to support you. What's going on?",
                    "I'm ready to assist you. How can I make your day better?"
                ]
            elif any(word in message_lower for word in ["thanks", "thank", "appreciate"]):
                responses = [
                    "You're very welcome! I'm glad I could help.",
                    "It's my pleasure! Feel free to ask me anything else.",
                    "Happy to help! Is there anything else you'd like to discuss?"
                ]
            else:
                responses = [
                    "That's interesting! Tell me more about that.",
                    "I'd love to hear your thoughts on this. Can you elaborate?",
                    "Thanks for sharing that with me. What else would you like to discuss?",
                    "I'm here to listen and chat. What's important to you right now?"
                ]
        
        return random.choice(responses)
    
    def _build_prompt(self, message: str, context: list, user_emotion: dict):
        """Build context-aware prompt"""
        prompt = "You are Buddy, a helpful AI assistant.\n\n"
        
        # Add emotion context
        if user_emotion:
            emotion = user_emotion.get("emotion", "neutral")
            prompt += f"User emotion: {emotion}. Respond appropriately.\n\n"
        
        prompt += f"Human: {message}\nAssistant:"
        
        return prompt
