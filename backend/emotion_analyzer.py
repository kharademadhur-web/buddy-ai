from transformers import pipeline
import torch

class EmotionAnalyzer:
    def __init__(self):
        self.emotion_pipeline = None
        self.sentiment_pipeline = None
        self.load_models()
    
    def load_models(self):
        """Load emotion analysis models"""
        try:
            print("Loading emotion analysis models...")
            
            # Emotion classification (6 emotions)
            self.emotion_pipeline = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                top_k=None,
                device=-1  # CPU
            )
            
            # Sentiment analysis
            self.sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=-1  # CPU
            )
            
            print("✓ Emotion models loaded successfully")
        except Exception as e:
            print(f"✗ Error loading emotion models: {e}")
            raise
    
    def is_loaded(self):
        return self.emotion_pipeline is not None
    
    def analyze(self, text: str):
        """Analyze emotion and sentiment"""
        try:
            # Get emotion
            emotion_results = self.emotion_pipeline(text)[0]
            top_emotion = max(emotion_results, key=lambda x: x['score'])
            
            # Get sentiment
            sentiment_results = self.sentiment_pipeline(text)[0]
            sentiment_score = sentiment_results['score']
            if sentiment_results['label'] == 'NEGATIVE':
                sentiment_score = -sentiment_score
            
            return {
                "emotion": top_emotion['label'].lower(),
                "confidence": top_emotion['score'],
                "sentiment": sentiment_score,
                "all_emotions": {e['label']: e['score'] for e in emotion_results}
            }
            
        except Exception as e:
            return {
                "emotion": "neutral",
                "confidence": 0.0,
                "sentiment": 0.0,
                "error": str(e)
            }