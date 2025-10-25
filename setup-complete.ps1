# 🤖 Buddy AI - Complete Setup Script for Windows
# This script will set up your AI assistant from scratch

param(
    [switch]$SkipOllama,
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [string]$Model = "llama3.1:8b"
)

$ErrorActionPreference = "Stop"

Write-Host "🤖 Buddy AI - Complete Setup Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction SilentlyContinue) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Function to show progress
function Write-Progress-Step {
    param($Step, $Total, $Message)
    Write-Host "[$Step/$Total] $Message" -ForegroundColor Yellow
}

# Function to show success
function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

# Function to show error
function Write-Error-Message {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Function to show warning
function Write-Warning-Message {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

try {
    $TotalSteps = 8
    $CurrentStep = 0

    # Step 1: Check Prerequisites
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Checking prerequisites..."
    
    # Check Python
    if (-not (Test-Command "python")) {
        Write-Error-Message "Python is not installed or not in PATH"
        Write-Host "Please install Python 3.10+ from https://python.org"
        exit 1
    }
    
    $pythonVersion = python --version
    Write-Host "  Found: $pythonVersion"
    
    # Check Node.js
    if (-not (Test-Command "node")) {
        Write-Error-Message "Node.js is not installed or not in PATH"
        Write-Host "Please install Node.js from https://nodejs.org"
        exit 1
    }
    
    $nodeVersion = node --version
    Write-Host "  Found: Node.js $nodeVersion"
    
    # Check npm
    if (-not (Test-Command "npm")) {
        Write-Error-Message "npm is not installed or not in PATH"
        exit 1
    }
    
    $npmVersion = npm --version
    Write-Host "  Found: npm $npmVersion"
    
    Write-Success "Prerequisites check completed"

    # Step 2: Install/Check Ollama
    if (-not $SkipOllama) {
        $CurrentStep++
        Write-Progress-Step $CurrentStep $TotalSteps "Setting up Ollama..."
        
        if (-not (Test-Command "ollama")) {
            Write-Host "  Installing Ollama..."
            
            # Download and install Ollama
            $ollamaUrl = "https://ollama.com/download/windows"
            $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
            
            Write-Host "  Downloading Ollama installer..."
            Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaInstaller
            
            Write-Host "  Running Ollama installer..."
            Start-Process -FilePath $ollamaInstaller -Wait
            
            # Add Ollama to PATH if needed
            $ollamaPath = "$env:USERPROFILE\AppData\Local\Programs\Ollama"
            if (Test-Path $ollamaPath) {
                $env:PATH += ";$ollamaPath"
                [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
            }
            
            # Wait for Ollama service to start
            Write-Host "  Waiting for Ollama service to start..."
            Start-Sleep -Seconds 10
        }
        
        # Verify Ollama installation
        if (Test-Command "ollama") {
            Write-Success "Ollama is ready"
        } else {
            Write-Error-Message "Ollama installation failed"
            Write-Host "Please install Ollama manually from https://ollama.com"
            exit 1
        }
    }

    # Step 3: Download AI Model
    if (-not $SkipOllama) {
        $CurrentStep++
        Write-Progress-Step $CurrentStep $TotalSteps "Downloading AI model ($Model)..."
        
        Write-Host "  This may take several minutes depending on your internet speed..."
        Write-Host "  Model size: ~4.9GB"
        
        try {
            ollama pull $Model
            Write-Success "Model $Model downloaded successfully"
        } catch {
            Write-Error-Message "Failed to download model $Model"
            Write-Host "Error: $_"
            exit 1
        }
    }

    # Step 4: Create Custom Model
    if (-not $SkipOllama) {
        $CurrentStep++
        Write-Progress-Step $CurrentStep $TotalSteps "Creating custom Buddy AI model..."
        
        if (Test-Path "Modelfile") {
            try {
                ollama create buddy-ai -f Modelfile
                Write-Success "Custom Buddy AI model created"
            } catch {
                Write-Warning-Message "Failed to create custom model, will use base model"
                Write-Host "Error: $_"
            }
        } else {
            Write-Warning-Message "Modelfile not found, skipping custom model creation"
        }
    }

    # Step 5: Set up Python Backend
    if (-not $SkipBackend) {
        $CurrentStep++
        Write-Progress-Step $CurrentStep $TotalSteps "Setting up Python backend..."
        
        # Create virtual environment
        Write-Host "  Creating virtual environment..."
        python -m venv venv
        
        # Activate virtual environment
        Write-Host "  Activating virtual environment..."
        & ".\venv\Scripts\Activate.ps1"
        
        # Upgrade pip
        Write-Host "  Upgrading pip..."
        python -m pip install --upgrade pip
        
        # Install backend dependencies
        if (Test-Path "backend\requirements.txt") {
            Write-Host "  Installing backend dependencies..."
            pip install -r backend\requirements.txt
        } else {
            Write-Host "  Installing basic dependencies..."
            pip install fastapi uvicorn python-multipart requests transformers torch torchvision torchaudio
        }
        
        Write-Success "Python backend setup completed"
    }

    # Step 6: Set up Frontend
    if (-not $SkipFrontend) {
        $CurrentStep++
        Write-Progress-Step $CurrentStep $TotalSteps "Setting up frontend dependencies..."
        
        if (Test-Path "package.json") {
            Write-Host "  Installing npm dependencies..."
            npm install
            Write-Success "Frontend dependencies installed"
        } else {
            Write-Warning-Message "package.json not found, skipping npm install"
        }
    }

    # Step 7: Run Setup Scripts
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Running additional setup scripts..."
    
    # Run OpenELM setup if it exists
    if (Test-Path "setup_openelm.py") {
        Write-Host "  Running OpenELM setup..."
        try {
            & ".\venv\Scripts\python.exe" setup_openelm.py
            Write-Success "OpenELM setup completed"
        } catch {
            Write-Warning-Message "OpenELM setup failed, continuing..."
            Write-Host "Error: $_"
        }
    }
    
    # Run complete setup if it exists
    if (Test-Path "complete_openelm_setup.py") {
        Write-Host "  Running complete OpenELM setup..."
        try {
            & ".\venv\Scripts\python.exe" complete_openelm_setup.py
            Write-Success "Complete OpenELM setup finished"
        } catch {
            Write-Warning-Message "Complete OpenELM setup failed, continuing..."
            Write-Host "Error: $_"
        }
    }

    # Step 8: Verify Installation
    $CurrentStep++
    Write-Progress-Step $CurrentStep $TotalSteps "Verifying installation..."
    
    # Test Ollama models
    Write-Host "  Checking Ollama models..."
    $models = ollama list
    Write-Host "  Available models:"
    Write-Host $models
    
    # Test Python backend
    if (Test-Path "backend\main.py") {
        Write-Host "  Backend API file found"
    }
    
    # Test frontend
    if (Test-Path "index.html") {
        Write-Host "  Frontend files found"
    }
    
    Write-Success "Installation verification completed"

    # Final Success Message
    Write-Host ""
    Write-Host "🎉 Buddy AI Setup Completed Successfully!" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 What was installed:" -ForegroundColor Cyan
    if (-not $SkipOllama) {
        Write-Host "  ✅ Ollama AI runtime"
        Write-Host "  ✅ $Model language model"
        Write-Host "  ✅ Custom Buddy AI model"
    }
    if (-not $SkipBackend) {
        Write-Host "  ✅ Python virtual environment"
        Write-Host "  ✅ Backend dependencies"
    }
    if (-not $SkipFrontend) {
        Write-Host "  ✅ Frontend dependencies"
    }
    Write-Host ""
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Start the backend server:"
    Write-Host "     .\venv\Scripts\Activate.ps1"
    Write-Host "     python backend\main.py"
    Write-Host ""
    Write-Host "  2. In another terminal, start the frontend:"
    Write-Host "     npm run dev"
    Write-Host ""
    Write-Host "  3. Open your browser to http://localhost:8080"
    Write-Host ""
    Write-Host "  4. Test the setup:"
    Write-Host "     python test_openelm.py"
    Write-Host ""
    Write-Host "📖 Documentation:"
    Write-Host "  - README.md - Main project documentation"
    Write-Host "  - OPENELM_SETUP.md - OpenELM specific setup"
    Write-Host "  - PROJECT_STATUS.md - Current project status"
    Write-Host ""
    Write-Host "🎯 Your AI assistant is ready to use!" -ForegroundColor Green

} catch {
    Write-Error-Message "Setup failed with error: $_"
    Write-Host ""
    Write-Host "🔧 Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "  1. Make sure you have admin privileges"
    Write-Host "  2. Check your internet connection"
    Write-Host "  3. Ensure Python 3.10+ and Node.js are installed"
    Write-Host "  4. Try running individual setup steps manually"
    Write-Host ""
    Write-Host "  Run with parameters to skip sections:"
    Write-Host "  .\setup-complete.ps1 -SkipOllama    # Skip Ollama setup"
    Write-Host "  .\setup-complete.ps1 -SkipFrontend  # Skip frontend setup"
    Write-Host "  .\setup-complete.ps1 -SkipBackend   # Skip backend setup"
    
    exit 1
}

# Create a simple start script
@"
# 🚀 Buddy AI Start Script
Write-Host "🤖 Starting Buddy AI..." -ForegroundColor Cyan

# Start Ollama service (if not running)
Start-Process "ollama" "serve" -WindowStyle Hidden -ErrorAction SilentlyContinue

# Wait for Ollama to start
Start-Sleep -Seconds 3

Write-Host "✅ Ollama service started"
Write-Host "📖 Run the following commands in separate terminals:"
Write-Host ""
Write-Host "Backend:"
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host "  python backend\main.py"
Write-Host ""
Write-Host "Frontend:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open: http://localhost:8080"
"@ | Out-File -FilePath "start-buddy.ps1" -Encoding UTF8

Write-Host ""
Write-Host "💡 Quick start script created: start-buddy.ps1" -ForegroundColor Cyan