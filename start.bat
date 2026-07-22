@echo off
REM ==========================================
REM  AI-Insight - Windows Start Script
REM ==========================================

echo Starting AI-Insight...
echo.

REM Start backend
echo [1/2] Starting Python backend (AI-Insight API)...
cd /d "%~dp0backend"
start "AI-Viz-Backend" cmd /k "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Start frontend
echo [2/2] Starting frontend (Vite dev server)...
cd /d "%~dp0frontend"
start "AI-Viz-Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo  API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Two windows have opened. Close them to stop the servers.
pause
