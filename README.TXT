BACK end
-pip install aiofiles
-python -m venv venv
-.\venv\Scripts\activate
-pip install fastapi uvicorn ffmpeg-python python-multipart
-uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
FRONT END 
-npm install react-icons
-npm install axios