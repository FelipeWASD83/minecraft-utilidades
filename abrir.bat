@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:4349/
python -m http.server 4349 --bind 127.0.0.1
