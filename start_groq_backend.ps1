#!/usr/bin/env pwsh
# Buddy AI - Start Backend with Groq
# This script starts the FastAPI backend using Groq for AI processing

Write-Host 'Starting Buddy AI Backend with Groq...' -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path '.env')) {
    Write-Host '.env file not found. Creating from template...' -ForegroundColor Yellow
    Copy-Item '.env.example' '.env'
    Write-Host 'Please edit .env file and add your GROQ_API_KEY' -ForegroundColor Red
    Write-Host 'Get your free API key from: https://console.groq.com/keys' -ForegroundColor Cyan
    exit 1
}

# Check if Groq API key is set
$envContent = Get-Content '.env' -Raw
if ($envContent -match 'GROQ_API_KEY=gsk_your_actual_key_here' -or $envContent -notmatch 'GROQ_API_KEY=gsk_') {
    Write-Host 'GROQ_API_KEY not set properly in .env file' -ForegroundColor Red
    Write-Host 'Please add your actual Groq API key to .env file' -ForegroundColor Yellow
    Write-Host 'Get your free API key from: https://console.groq.com/keys' -ForegroundColor Cyan
    exit 1
}

# Load environment variables
foreach ($line in Get-Content '.env') {
    if ($line -match '^([^#].+?)=(.+)$') {
        $name = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        Write-Host "Loaded $name" -ForegroundColor Green
    }
}

# Check if Python virtual environment exists
if (-not (Test-Path 'venv')) {
    Write-Host 'Creating Python virtual environment...' -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host 'Activating virtual environment...' -ForegroundColor Yellow
& 'venv\Scripts\Activate.ps1'

# Install/upgrade dependencies
Write-Host 'Installing dependencies...' -ForegroundColor Yellow
pip install -r backend/requirements.txt

# Change to backend directory
Set-Location backend

# Start the server
Write-Host 'Starting FastAPI server...' -ForegroundColor Green
Write-Host 'API Docs: http://localhost:8000/docs' -ForegroundColor Cyan
Write-Host 'Health: http://localhost:8000/api/health' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Yellow
Write-Host ''

python main.py
