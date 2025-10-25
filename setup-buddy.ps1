# Buddy AI Setup Script
Write-Host "🤖 Setting up Buddy AI..." -ForegroundColor Cyan

# Check if Ollama is running
Write-Host "📡 Checking Ollama service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434" -Method Get -TimeoutSec 5
    Write-Host "✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama service not running. Please start it first:" -ForegroundColor Red
    Write-Host "   Run: ollama serve" -ForegroundColor Yellow
    exit 1
}

# Check if model is downloaded
Write-Host "🔍 Checking for Llama 3.1 8B model..." -ForegroundColor Yellow
$models = ollama list
if ($models -match "llama3.1:8b") {
    Write-Host "✅ Llama 3.1 8B model found" -ForegroundColor Green
} else {
    Write-Host "⬇️ Downloading Llama 3.1 8B model (this may take a while)..." -ForegroundColor Yellow
    ollama pull llama3.1:8b
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Model downloaded successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to download model" -ForegroundColor Red
        exit 1
    }
}

# Create Buddy AI model
Write-Host "🛠️ Creating Buddy AI model..." -ForegroundColor Yellow
ollama create buddy-ai -f Modelfile
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Buddy AI model created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create Buddy AI model" -ForegroundColor Red
    exit 1
}

# Test the model
Write-Host "🧪 Testing Buddy AI..." -ForegroundColor Yellow
$testResponse = ollama run buddy-ai "Hello, I'm testing if you're working correctly" | Out-String
if ($testResponse -and $testResponse.Length -gt 10) {
    Write-Host "✅ Buddy AI is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Setup Complete! 🎉" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "To start using Buddy AI, run:" -ForegroundColor Cyan
    Write-Host "   ollama run buddy-ai" -ForegroundColor White
    Write-Host ""
    Write-Host "Example conversation starters:" -ForegroundColor Yellow
    Write-Host "   • 'I'm feeling anxious about tomorrow'"
    Write-Host "   • 'Solve: 2x + 5 = 15'"
    Write-Host "   • 'Should I take this new job?'"
    Write-Host "   • 'Explain quantum computing simply'"
} else {
    Write-Host "❌ Buddy AI test failed" -ForegroundColor Red
    exit 1
}