import subprocess
import time

def test_model(prompt):
    print(f"Testing: {prompt[:50]}...")
    
    try:
        result = subprocess.run(
            ['ollama', 'run', 'buddy-ai-openelm', prompt],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response = result.stdout.strip()
            print(f"Response: {response[:200]}...")
            return True
        else:
            print(f"Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"Test failed: {e}")
        return False

def main():
    print("OpenELM 1.1B Test")
    print("=" * 30)
    
    tests = [
        "Hi! I'm excited about learning AI today!",
        "I'm stressed about work. Can you help?",
        "Solve: 2x + 8 = 20",
        "I love photography. Any tips?"
    ]
    
    passed = 0
    for test in tests:
        if test_model(test):
            passed += 1
        time.sleep(2)
    
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("To chat: ollama run buddy-ai-openelm")

if __name__ == "__main__":
    main()
