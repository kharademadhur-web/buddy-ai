import pyttsx3
import speech_recognition as sr
import os
import time

class VoiceHandler:
    def __init__(self):
        self.tts_engine = pyttsx3.init()
        self.recognizer = sr.Recognizer()
        self.setup_voice()
    
    def setup_voice(self):
        """Configure text-to-speech settings"""
        voices = self.tts_engine.getProperty('voices')
        # Set female voice if available
        if len(voices) > 1:
            self.tts_engine.setProperty('voice', voices[1].id)
        self.tts_engine.setProperty('rate', 175)
        self.tts_engine.setProperty('volume', 0.9)
    
    def transcribe(self, audio_path: str):
        """Transcribe audio to text"""
        try:
            with sr.AudioFile(audio_path) as source:
                audio = self.recognizer.record(source)
                text = self.recognizer.recognize_google(audio)
                return text
        except Exception as e:
            return f"[Transcription error: {str(e)}]"
    
    def synthesize(self, text: str, voice: str = "female", speed: float = 1.0):
        """Convert text to speech"""
        try:
            # Adjust speed
            base_rate = 175
            self.tts_engine.setProperty('rate', int(base_rate * speed))
            
            # Generate filename
            filename = f"response_{int(time.time())}.mp3"
            filepath = f"frontend/assets/audio/{filename}"
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # Save audio
            self.tts_engine.save_to_file(text, filepath)
            self.tts_engine.runAndWait()
            
            return filename
            
        except Exception as e:
            print(f"TTS error: {e}")
            return None