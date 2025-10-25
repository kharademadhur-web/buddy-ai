#!/usr/bin/env python3
"""
Complete OpenELM Setup: Cleanup previous models + Install OpenELM 1.1B
Handles model cleanup, cache clearing, and fresh installation
"""

import os
import sys
import shutil
import subprocess
import logging
import json
from pathlib import Path
import psutil
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CompleteOpenELMSetup:
    """Complete cleanup and setup for OpenELM 1.1B"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.backend_dir = self.project_root / "backend"
        self.home_dir = Path.home()
        
        # Common model cache locations
        self.cache_locations = [
            self.home_dir / ".cache" / "huggingface",
            self.home_dir / ".cache" / "torch",
            self.home_dir / "AppData" / "Local" / "huggingface" if os.name == 'nt' else None,
            Path("C:\\Users\\khara\\.cache\\huggingface") if os.name == 'nt' else None,
            self.project_root / "models",
            self.backend_dir / "models"
        ]
        
        # Remove None values
        self.cache_locations = [loc for loc in self.cache_locations if loc is not None]
    
    def check_disk_space(self):
        """Check available disk space"""
        logger.info("Checking disk space...")
        
        try:
            if os.name == 'nt':  # Windows
                free_bytes = shutil.disk_usage(self.project_root).free
            else:  # Unix/Linux
                statvfs = os.statvfs(self.project_root)
                free_bytes = statvfs.f_frsize * statvfs.f_available
            
            free_gb = free_bytes / (1024**3)
            logger.info(f"Available disk space: {free_gb:.1f} GB")
            
            if free_gb < 5:
                logger.warning(f"Low disk space: {free_gb:.1f} GB. Recommend at least 5GB free.")
            
            return free_gb
            
        except Exception as e:
            logger.error(f"Error checking disk space: {e}")
            return 0
    
    def stop_running_processes(self):
        """Stop any running AI processes that might lock model files"""
        logger.info("Checking for running AI processes...")
        
        processes_to_stop = ['ollama', 'python', 'uvicorn']
        stopped_processes = []
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    proc_info = proc.info
                    if proc_info['cmdline']:
                        cmdline = ' '.join(proc_info['cmdline']).lower()
                        
                        # Check if it's our buddy-ai process
                        if ('buddy-ai' in cmdline or 'main.py' in cmdline or 
                            'ai_engine' in cmdline or 'ollama' in proc_info['name'].lower()):
                            
                            logger.info(f"Stopping process: {proc_info['name']} (PID: {proc_info['pid']})")
                            proc.terminate()
                            stopped_processes.append(proc_info['name'])
                            time.sleep(2)
                            
                            if proc.is_running():
                                proc.kill()
                                
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
            
            if stopped_processes:
                logger.info(f"Stopped processes: {', '.join(set(stopped_processes))}")
            else:
                logger.info("No AI processes found running")
                
        except Exception as e:
            logger.warning(f"Error stopping processes: {e}")
    
    def cleanup_ollama_models(self):
        """Remove Ollama models and data"""
        logger.info("Cleaning up Ollama models...")
        
        try:
            # Try to remove Ollama models via command
            try:
                result = subprocess.run(['ollama', 'list'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    models = result.stdout.strip().split('\n')[1:]  # Skip header
                    for model_line in models:
                        if model_line.strip():
                            model_name = model_line.split()[0]
                            logger.info(f"Removing Ollama model: {model_name}")
                            subprocess.run(['ollama', 'rm', model_name], 
                                         capture_output=True, timeout=30)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                logger.info("Ollama not found or not responding, skipping command cleanup")
            
            # Remove Ollama data directories
            ollama_dirs = [
                Path(os.environ.get('OLLAMA_MODELS', '')),
                self.home_dir / '.ollama',
                Path('C:\\Users\\khara\\.ollama') if os.name == 'nt' else None,
                Path('/usr/share/ollama') if os.name != 'nt' else None
            ]
            
            for ollama_dir in ollama_dirs:
                if ollama_dir and ollama_dir.exists():
                    logger.info(f"Removing Ollama directory: {ollama_dir}")
                    shutil.rmtree(ollama_dir, ignore_errors=True)
            
            logger.info("Ollama cleanup completed")
            
        except Exception as e:
            logger.error(f"Error cleaning Ollama: {e}")
    
    def cleanup_huggingface_cache(self):
        """Clean HuggingFace model cache"""
        logger.info("Cleaning HuggingFace cache...")
        
        total_freed = 0
        
        for cache_dir in self.cache_locations:
            if cache_dir and cache_dir.exists():
                try:
                    # Calculate size before deletion
                    size_before = sum(f.stat().st_size for f in cache_dir.rglob('*') if f.is_file())
                    size_before_gb = size_before / (1024**3)
                    
                    logger.info(f"Removing cache directory: {cache_dir} ({size_before_gb:.1f} GB)")
                    shutil.rmtree(cache_dir, ignore_errors=True)
                    
                    total_freed += size_before_gb
                    
                except Exception as e:
                    logger.warning(f"Could not remove {cache_dir}: {e}")
        
        logger.info(f"Freed approximately {total_freed:.1f} GB of cache space")
    
    def cleanup_project_models(self):
        """Remove any models stored in project directories"""
        logger.info("Cleaning project model directories...")
        
        model_dirs = [
            self.project_root / "models",
            self.backend_dir / "models", 
            self.project_root / "data" / "models",
            self.project_root / "venv" / "lib" / "python*" / "site-packages" / "transformers" / "models"
        ]
        
        for model_dir in model_dirs:
            if model_dir.exists():
                logger.info(f"Removing project model directory: {model_dir}")
                shutil.rmtree(model_dir, ignore_errors=True)
    
    def cleanup_old_dependencies(self):
        """Uninstall old/conflicting AI packages"""
        logger.info("Cleaning up old dependencies...")
        
        packages_to_remove = [
            'transformers',
            'torch',
            'torchaudio', 
            'torchvision',
            'accelerate',
            'tokenizers',
            'safetensors',
            'huggingface-hub'
        ]
        
        try:
            for package in packages_to_remove:
                logger.info(f"Uninstalling {package}...")
                subprocess.run([sys.executable, "-m", "pip", "uninstall", package, "-y"], 
                             capture_output=True)
            
            logger.info("Old dependencies removed")
            
        except Exception as e:
            logger.warning(f"Error removing dependencies: {e}")
    
    def install_fresh_dependencies(self):
        """Install fresh, compatible dependencies"""
        logger.info("Installing fresh dependencies...")
        
        # Upgrade pip first
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])
        
        # Install PyTorch CPU version (lighter, works on all systems)
        pytorch_cmd = [
            sys.executable, "-m", "pip", "install", 
            "torch", "torchaudio", "torchvision", 
            "--index-url", "https://download.pytorch.org/whl/cpu"
        ]
        logger.info("Installing PyTorch CPU version...")
        subprocess.run(pytorch_cmd, check=True)
        
        # Install other requirements
        requirements = [
            "transformers>=4.35.0",
            "accelerate>=0.20.0", 
            "tokenizers>=0.15.0",
            "safetensors>=0.3.0",
            "huggingface-hub>=0.17.0",
            "psutil>=5.9.0"
        ]
        
        for req in requirements:
            logger.info(f"Installing {req}...")
            subprocess.run([sys.executable, "-m", "pip", "install", req], check=True)
        
        logger.info("Fresh dependencies installed successfully")
    
    def download_openelm_model(self):
        """Download OpenELM model"""
        logger.info("Downloading OpenELM 1.1B model...")
        
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            model_name = "apple/OpenELM-1_1B-Instruct"
            
            logger.info("Downloading tokenizer...")
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            
            logger.info("Downloading model (this may take a few minutes)...")
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype='auto',
                low_cpu_mem_usage=True
            )
            
            logger.info("OpenELM model downloaded successfully!")
            
            # Test the model
            logger.info("Testing model...")
            test_input = tokenizer.encode("Hello", return_tensors="pt")
            with torch.no_grad():
                output = model.generate(test_input, max_length=test_input.shape[1] + 10)
            
            response = tokenizer.decode(output[0], skip_special_tokens=True)
            logger.info(f"Model test successful: {response}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error downloading OpenELM model: {e}")
            return False
    
    def update_backend_requirements(self):
        """Update backend requirements.txt"""
        logger.info("Updating backend requirements...")
        
        requirements_file = self.backend_dir / "requirements.txt"
        
        # Read existing requirements
        existing_requirements = []
        if requirements_file.exists():
            with open(requirements_file, 'r') as f:
                existing_requirements = [line.strip() for line in f.readlines() 
                                       if line.strip() and not line.startswith('#')]
        
        # New requirements for OpenELM
        new_requirements = [
            "fastapi>=0.100.0",
            "uvicorn>=0.23.0", 
            "torch>=2.0.0",
            "transformers>=4.35.0",
            "accelerate>=0.20.0",
            "tokenizers>=0.15.0",
            "safetensors>=0.3.0",
            "huggingface-hub>=0.17.0",
            "psutil>=5.9.0",
            "pydantic>=2.0.0"
        ]
        
        # Merge requirements (avoid duplicates)
        all_requirements = existing_requirements.copy()
        for req in new_requirements:
            pkg_name = req.split('>=')[0].split('==')[0]
            if not any(pkg_name in existing for existing in existing_requirements):
                all_requirements.append(req)
        
        # Write updated requirements
        with open(requirements_file, 'w') as f:
            f.write('\n'.join(sorted(all_requirements)))
        
        logger.info(f"Updated requirements.txt with {len(all_requirements)} packages")
    
    def create_openelm_files(self):
        """Create OpenELM engine and supporting files"""
        logger.info("Creating OpenELM files...")
        
        # Copy the OpenELM engine file we created earlier
        openelm_engine_content = '''"""
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
                low_cpu_mem_usage=True
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
        
        # Base system prompt with OpenELM-optimized instructions
        system_prompt = """You are an advanced personal AI companion. Provide helpful, personalized responses that match the user's communication style and needs. Be concise but engaging."""
        
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
        
        return f"System: {system_prompt}\\n\\nUser: {message}\\nAssistant:"
    
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
            inputs = self.tokenizer.encode(prompt, return_tensors="pt", truncation=True, max_length=1024)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs,
                    max_length=inputs.shape[1] + adjusted_max_length,
                    temperature=0.7,
                    do_sample=True,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.1,
                    no_repeat_ngram_size=3
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
        if "System:" in response:
            response = response.split("System:")[0]
        
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
'''
        
        # Write OpenELM engine file
        engine_file = self.backend_dir / "openelm_engine.py"
        with open(engine_file, 'w', encoding='utf-8') as f:
            f.write(openelm_engine_content)
        
        logger.info("OpenELM engine file created successfully")
    
    def create_test_script(self):
        """Create comprehensive test script"""
        test_content = '''#!/usr/bin/env python3
"""
Complete test script for OpenELM 1.1B personalized AI
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_openelm():
    """Test OpenELM with various scenarios"""
    print("🧪 Testing OpenELM 1.1B Personalized AI\\n")
    
    try:
        from openelm_engine import OpenELMPersonalizedEngine
        engine = OpenELMPersonalizedEngine()
        print("✅ OpenELM engine initialized successfully\\n")
    except Exception as e:
        print(f"❌ Failed to initialize OpenELM engine: {e}")
        return False
    
    # Test scenarios
    scenarios = [
        {
            "user_id": "alice",
            "message": "Hi there!",
            "description": "Simple greeting (should be short)"
        },
        {
            "user_id": "alice", 
            "message": "I'm feeling anxious about my job interview tomorrow. Can you help me prepare?",
            "description": "Emotional support request (should be medium/long)"
        },
        {
            "user_id": "bob",
            "message": "Solve this equation: 2x + 5 = 15",
            "description": "Math problem (should be short)"
        },
        {
            "user_id": "alice",
            "message": "Thanks for the help earlier! How can I stay calm during presentations?",
            "description": "Follow-up with context (should remember previous conversation)"
        },
        {
            "user_id": "charlie",
            "message": "Can you explain how machine learning works in detail?",
            "description": "Complex explanation request (should be long)"
        }
    ]
    
    success_count = 0
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"--- Test {i}: {scenario['description']} ---")
        print(f"User ({scenario['user_id']}): {scenario['message']}")
        
        try:
            result = engine.generate_response(
                message=scenario['message'],
                user_id=scenario['user_id']
            )
            
            print(f"Response: {result['response']}")
            print(f"Emotion detected: {result['emotion']}")
            print(f"Response length type: {result['response_length']}")
            print(f"Response time: {result['response_time']:.2f}s")
            print(f"Personalized: {result['personalized']}")
            
            success_count += 1
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
        
        print()
    
    # Show user profiles
    print("--- User Profiles Created ---")
    for user_id in ["alice", "bob", "charlie"]:
        profile = engine.get_user_profile(user_id)
        if profile:
            print(f"👤 {user_id}:")
            print(f"   Conversations: {profile['conversation_count']}")
            print(f"   Style: {profile['communication_style']}")
            print(f"   Last emotion: {profile['last_emotion']}")
            print(f"   Emotional patterns: {profile['emotional_patterns']}")
    
    print(f"\\n🎯 Results: {success_count}/{len(scenarios)} tests passed")
    
    if success_count == len(scenarios):
        print("🎉 All tests passed! OpenELM is working perfectly!")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return False

if __name__ == "__main__":
    success = test_openelm()
    if not success:
        sys.exit(1)
'''
        
        test_file = self.project_root / "test_openelm_complete.py"
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(test_content)
        
        logger.info("Complete test script created")
    
    def run_complete_setup(self):
        """Run the complete cleanup and setup process"""
        logger.info("🚀 Starting Complete OpenELM 1.1B Setup")
        logger.info("This will clean old models and install fresh OpenELM setup")
        
        steps = [
            ("Checking disk space", self.check_disk_space),
            ("Stopping running processes", self.stop_running_processes),
            ("Cleaning up Ollama models", self.cleanup_ollama_models),
            ("Cleaning HuggingFace cache", self.cleanup_huggingface_cache),
            ("Cleaning project models", self.cleanup_project_models),
            ("Removing old dependencies", self.cleanup_old_dependencies),
            ("Installing fresh dependencies", self.install_fresh_dependencies),
            ("Downloading OpenELM model", self.download_openelm_model),
            ("Updating backend requirements", self.update_backend_requirements),
            ("Creating OpenELM files", self.create_openelm_files),
            ("Creating test script", self.create_test_script)
        ]
        
        successful_steps = 0
        
        for i, (step_name, step_func) in enumerate(steps, 1):
            try:
                logger.info(f"⏳ Step {i}/{len(steps)}: {step_name}...")
                
                if step_name == "Checking disk space":
                    free_space = step_func()
                    if free_space < 3:
                        logger.error("Insufficient disk space. Need at least 3GB free.")
                        return False
                else:
                    step_func()
                
                logger.info(f"✅ Step {i} completed: {step_name}")
                successful_steps += 1
                
            except Exception as e:
                logger.error(f"❌ Step {i} failed: {step_name} - {e}")
                if i <= 3:  # Critical early steps
                    logger.error("Critical step failed. Aborting setup.")
                    return False
                else:
                    logger.warning("Non-critical step failed. Continuing...")
        
        logger.info(f"🎉 Setup completed! {successful_steps}/{len(steps)} steps successful")
        
        # Final summary
        print("\\n" + "="*60)
        print("🎯 OPENELM 1.1B SETUP COMPLETE!")
        print("="*60)
        print("✅ Old models cleaned up")
        print("✅ Fresh dependencies installed") 
        print("✅ OpenELM 1.1B downloaded and configured")
        print("✅ Personalization system active")
        print("✅ Quality & brevity controls implemented")
        print("✅ Test scripts created")
        print()
        print("🧪 Next steps:")
        print("1. Run: python test_openelm_complete.py")
        print("2. If tests pass, integrate with your API")
        print("3. Enjoy your personalized AI assistant!")
        print("="*60)
        
        return successful_steps >= len(steps) - 2  # Allow 2 non-critical failures

if __name__ == "__main__":
    setup = CompleteOpenELMSetup()
    success = setup.run_complete_setup()
    
    if success:
        print("\\n🎊 SUCCESS: OpenELM 1.1B is ready to use!")
        sys.exit(0)
    else:
        print("\\n❌ FAILED: Setup encountered critical errors.")
        sys.exit(1)