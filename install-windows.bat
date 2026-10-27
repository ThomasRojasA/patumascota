@echo off
cd /d "%~dp0"
echo Installing root dependencies...
call npm install
if errorlevel 1 goto error
echo Installing backend dependencies...
call npm install --prefix backend
if errorlevel 1 goto error
echo Installing frontend dependencies...
call npm install --prefix frontend
if errorlevel 1 goto error
echo.
echo Installation complete. Run start-dev.bat to start the app.
pause
goto end
:error
echo Installation failed. Check that Node.js and npm are installed.
pause
:end
