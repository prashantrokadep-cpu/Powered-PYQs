@echo off
echo =========================================
echo Setting up Python Backend Server
echo =========================================

cd backend

echo Installing requirements...
pip install -r requirements.txt

echo.
echo Starting Flask Server...
echo The API will run on http://localhost:5000
echo Keep this window open while using the Admin Upload feature.
echo.

python app.py
pause
