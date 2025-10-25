#!/usr/bin/env python3
import requests
import time

API_URL = "http://localhost:8000"

DEMO_CONVERSATIONS = [
    {
        "title": "Emotional Support",
        "messages": [
            "I'm feeling a bit down today",
            "I got some bad news at work",
            "Thanks for understanding"
        ]
    },
    {
        "title": "Casual Chat",
        "messages": [
            "Tell me something interesting",
            "That's fascinating!",
            "What else can you tell me?"
        ]
    },
    {
        "title": "Problem Solving",
        "messages": [
            "I need help organizing my schedule",
            "I have too many tasks",
            "Thanks for the advice!"
        ]
    }
]

def run_demo_conversation(conversation):
    """Run a demo conversation"""
    print(f"\n{'='*60}")
    print(f"  DEMO: {conversation['title']}")
    print(f"{'='*60}\n")
    
    for i, message in enumerate(conversation['messages'], 1):
        print(f"\n[{i}] User: {message}")
        print("    Buddy: ", end="", flush=True)
        
        response = requests.post(
            f"{API_URL}/api/chat",
            json={
                "message": message,
                "conversation_id": f"demo_{conversation['title']}"
            }
        )
        
        data = response.json()
        print(data['response'])
        print(f"    Emotion: {data['emotion']} | Sentiment: {data['sentiment']:.2f}")
        
        time.sleep(2)

def main():
    print("="*60)
    print("   BUDDY AI - DEMO SCRIPT")
    print("="*60)
    print("\nThis will run through sample conversations")
    print("to demonstrate Buddy AI's capabilities.\n")
    
    input("Press Enter to start...")
    
    for conversation in DEMO_CONVERSATIONS:
        run_demo_conversation(conversation)
        time.sleep(3)
    
    print(f"\n{'='*60}")
    print("   DEMO COMPLETE!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()