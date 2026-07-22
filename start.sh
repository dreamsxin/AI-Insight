#!/bin/bash
# ==========================================
#  AI-Insight - Linux/macOS Start Script
# ==========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting AI-Insight..."
echo ""

# Start backend
echo "[1/2] Starting Python backend (FastAPI)..."
cd "$SCRIPT_DIR/backend"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "[2/2] Starting frontend (Vite dev server)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo " Backend:  http://localhost:8000"
echo " Frontend: http://localhost:5173"
echo " API Docs: http://localhost:8000/docs"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap exit to kill background processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
