import requests
import time

API_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing /api/health...")
    response = requests.get(f"{API_URL}/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✓ Health check passed")

def test_chat():
    """Test chat endpoint"""
    print("\nTesting /api/chat...")
    response = requests.post(
        f"{API_URL}/api/chat",
        json={
            "message": "Hello, how are you?",
            "conversation_id": "test123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "emotion" in data
    assert "sentiment" in data
    print(f"✓ Chat response: {data['response'][:50]}...")
    print(f"✓ Emotion: {data['emotion']}")

def test_multiple_messages():
    """Test conversation flow"""
    print("\nTesting conversation flow...")
    messages = [
        "I'm feeling great today!",
        "Tell me something interesting",
        "That's amazing!"
    ]
    
    for msg in messages:
        response = requests.post(
            f"{API_URL}/api/chat",
            json={"message": msg, "conversation_id": "test123"}
        )
        assert response.status_code == 200
        print(f"✓ Sent: {msg[:30]}...")
        time.sleep(1)

def run_all_tests():
    """Run all tests"""
    print("="*50)
    print("🧪 BUDDY AI - AUTOMATED TESTS")
    print("="*50)
    
    try:
        test_health()
        test_chat()
        test_multiple_messages()
        print("\n" + "="*50)
        print("✅ ALL TESTS PASSED!")
        print("="*50)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_all_tests()