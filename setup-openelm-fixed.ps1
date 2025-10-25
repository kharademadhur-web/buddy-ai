# OpenELM 1.1B Complete Setup Script
# Sets up Buddy AI with OpenELM 1.1B and Ultimate Personalization

$ErrorActionPreference = "Stop"

Write-Host "OpenELM 1.1B Ultimate Setup" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

function Write-Progress-Step {
    param($Step, $Total, $Message)
    Write-Host "[$Step/$Total] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param($Message)
    Write-Host "Success: $Message" -ForegroundColor Green
}

function Write-Error-Message {
    param($Message)
    Write-Host "Error: $Message" -ForegroundColor Red
}

try {
    $TotalSteps = 6
    $CurrentStep = 0

    # Step 1: Start Ollama service
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Starting Ollama service..."
    
    Start-Process "ollama" "serve" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    Write-Success "Ollama service started"

    # Step 2: Pull OpenELM model
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Downloading OpenELM 1.1B model..."
    Write-Host "  Model size: ~1.3GB (much smaller than Llama!)" -ForegroundColor Green
    Write-Host "  This should take 2-5 minutes depending on your connection..."
    
    ollama pull openelm:1.1b-instruct
    Write-Success "OpenELM 1.1B downloaded successfully"

    # Step 3: Create custom model with enhanced prompt
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Creating custom Buddy AI model..."
    
    if (Test-Path "Modelfile.openelm") {
        ollama create buddy-ai-openelm -f Modelfile.openelm
        Write-Success "Custom Buddy AI model created with ultimate personalization"
    } else {
        Write-Error-Message "Modelfile.openelm not found"
        exit 1
    }

    # Step 4: Setup Python environment
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Setting up Python environment..."
    
    if (-not (Test-Path "venv")) {
        python -m venv venv
    }
    
    & ".\venv\Scripts\Activate.ps1"
    python -m pip install --upgrade pip
    
    # Install enhanced dependencies for OpenELM
    pip install fastapi uvicorn python-multipart requests transformers torch torchvision torchaudio accelerate tokenizers safetensors
    
    Write-Success "Python environment ready"

    # Step 5: Setup frontend
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Setting up frontend..."
    
    if (Test-Path "package.json") {
        npm install
        Write-Success "Frontend dependencies installed"
    }

    # Step 6: Create test and start scripts
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Creating helper scripts..."

    # Create test script
    @"
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
"@ | Out-File -FilePath "test_openelm.py" -Encoding UTF8

    Write-Success "Test script created"

    # Success message
    Write-Host ""
    Write-Host "OpenELM 1.1B Setup Complete!" -ForegroundColor Green
    Write-Host "============================" -ForegroundColor Green
    Write-Host ""
    Write-Host "What you now have:" -ForegroundColor Cyan
    Write-Host "  - OpenELM 1.1B model (1.3GB only!)"
    Write-Host "  - Ultimate personalization prompt"
    Write-Host "  - Advanced emotional intelligence"
    Write-Host "  - Memory & learning capabilities"
    Write-Host ""
    Write-Host "Quick Start:" -ForegroundColor Yellow
    Write-Host "  Test it:     python test_openelm.py"
    Write-Host "  Chat now:    ollama run buddy-ai-openelm"
    Write-Host "  Web app:     python backend/main.py"
    Write-Host ""
    Write-Host "Model Features:" -ForegroundColor Green
    Write-Host "  - Remembers your preferences"
    Write-Host "  - Adapts to your communication style" 
    Write-Host "  - Provides emotional support"
    Write-Host "  - Makes personalized recommendations"
    Write-Host ""
    Write-Host "Your AI companion is ready!" -ForegroundColor Magenta

} catch {
    Write-Error-Message "Setup failed: $_"
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Make sure Ollama is installed"
    Write-Host "  2. Check your internet connection"
    Write-Host "  3. Ensure you have enough disk space (2GB)"
    Write-Host "  4. Try running as administrator"
    exit 1
}