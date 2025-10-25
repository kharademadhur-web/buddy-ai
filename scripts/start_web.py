#!/usr/bin/env python3
import subprocess
import time
import webbrowser
import sys
import os

def run_command(cmd, cwd=None):
    """Run command in subprocess"""
    return subprocess.Popen(
        cmd,
        shell=True,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def main():
    print("="*50)
    print("   BUDDY AI - STARTING SERVER")
    print("="*50)
    print()
    
    # Check virtual environment
    venv_path = "venv/bin/activate" if os.name != 'nt' else "venv\\Scripts\\activate"
    if not os.path.exists(venv_path.split('/')[0]):
        print("Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", "venv"])
    
    # Install dependencies
    print("Installing dependencies...")
    pip_cmd = "venv/bin/pip" if os.name != 'nt' else "venv\\Scripts\\pip"
    subprocess.run([pip_cmd, "install", "-r", "backend/requirements.txt", "-q"])
    
    # Start backend
    print("\nStarting Backend Server...")
    python_cmd = "venv/bin/python" if os.name != 'nt' else "venv\\Scripts\\python"
    backend = run_command(f"{python_cmd} main.py", cwd="backend")
    
    # Wait for backend
    time.sleep(3)
    
    # Start frontend
    print("Starting Frontend Server...")
    frontend = run_command(f"{python_cmd} -m http.server 8080", cwd="frontend")
    
    # Wait and open browser
    time.sleep(2)
    print("\n" + "="*50)
    print("   BUDDY AI IS NOW RUNNING!")
    print("="*50)
    print("\nBackend:  http://localhost:8000")
    print("Frontend: http://localhost:8080")
    print("\nOpening browser...")
    
    webbrowser.open("http://localhost:8080")
    
    print("\nPress Ctrl+C to stop servers...")
    
    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nStopping servers...")
        backend.terminate()
        frontend.terminate()
        print("✓ Servers stopped")

if __name__ == "__main__":
    main()