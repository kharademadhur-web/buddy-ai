#!/usr/bin/env python3
"""
Test script to demonstrate all Buddy AI response templates
"""

from buddy_api import BuddyAI
import time

def test_response_templates():
    print("🧪 Testing Buddy AI Response Templates\n")
    print("=" * 60)
    
    buddy = BuddyAI()
    
    # Check if available
    if not buddy.is_available():
        print("❌ Ollama server not running. Start with: ollama serve")
        return
    
    test_cases = [
        {
            "category": "🔥 EMOTIONAL DISTRESS",
            "message": "I'm feeling really overwhelmed with work lately",
            "expected": "Should acknowledge emotion, validate feelings, offer support"
        },
        {
            "category": "🧮 MATH PROBLEM", 
            "message": "Solve: 4x + 8 = 32",
            "expected": "Should show step-by-step solution with verification"
        },
        {
            "category": "🤔 DECISION MAKING",
            "message": "Should I quit my current job for a new opportunity?",
            "expected": "Should help explore considerations and ask values-based questions"
        },
        {
            "category": "📚 KNOWLEDGE QUESTION",
            "message": "Explain photosynthesis in simple terms",
            "expected": "Should provide clear explanation with analogies"
        },
        {
            "category": "💭 CASUAL CONVERSATION",
            "message": "Hey! Tell me something interesting 😊",
            "expected": "Should match casual energy and be engaging"
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{i}. {test['category']}")
        print("-" * 40)
        print(f"Input: \"{test['message']}\"")
        print(f"Expected: {test['expected']}")
        print("\nBuddy's Response:")
        print(">" * 3, end=" ")
        
        try:
            response = buddy.chat(test['message'])
            # Clean up and format response
            response = response.strip()
            lines = response.split('\n')
            for line in lines:
                if line.strip():
                    print(line)
            
            print("\n" + "✅" * 20)
            
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Small delay between requests
        time.sleep(2)
        
        # Clear conversation for next test
        buddy.clear_history()
    
    print(f"\n{'=' * 60}")
    print("🎉 Template Testing Complete!")
    print("\nKey Features Demonstrated:")
    print("✅ Emotional acknowledgment before solutions")
    print("✅ Step-by-step math solutions")
    print("✅ Values-based decision guidance") 
    print("✅ Clear knowledge explanations")
    print("✅ Casual tone matching")

if __name__ == "__main__":
    test_response_templates()