@echo off
echo ================================
echo   BUDDY AI - STARTING SERVER
echo ================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install dependencies
echo Installing dependencies...
pip install -r backend/requirements.txt -q

REM Start backend
echo.
echo Starting Backend Server...
start cmd /k "cd backend && python main.py"

REM Wait for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend
echo Starting Frontend Server...
cd frontend
start cmd /k "python -m http.server 8080"

REM Wait and open browser
timeout /t 2 /nobreak > nul
echo.
echo ================================
echo   BUDDY AI IS NOW RUNNING!
echo ================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:8080
echo.
echo Opening browser...
start http://localhost:8080

echo.
echo Press any key to stop servers...
pause > nul
taskkill /F /IM python.exe