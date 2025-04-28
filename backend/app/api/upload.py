from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from app.services.video_processing import process_video

import shutil
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "temp_outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    srt: UploadFile = File(...),
    videos: list[UploadFile] = File(...)
):
    session_id = str(uuid.uuid4())
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)

    # Save audio
    audio_path = os.path.join(session_upload_dir, audio.filename)
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    # Save srt
    srt_path = os.path.join(session_upload_dir, srt.filename)
    with open(srt_path, "wb") as f:
        shutil.copyfileobj(srt.file, f)

    # Save all video files
    video_paths = []
    for video in videos:
        video_path = os.path.join(session_upload_dir, video.filename)
        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)
        video_paths.append(video_path)

    # Define output path
    output_path = os.path.join(OUTPUT_DIR, f"{session_id}_output.mp4")

    # Run processing in background
    background_tasks.add_task(process_video, audio_path, srt_path, video_paths, output_path)

    # Return the output path for download later
    return {"message": "Processing started", "download_url": f"/download/{session_id}_output.mp4"}

@router.get("/download/{file_name}")
def download_file(file_name: str):
    file_path = os.path.join(OUTPUT_DIR, file_name)
    if os.path.exists(file_path):
        return FileResponse(path=file_path, media_type='video/mp4', filename=file_name)
    else:
        return {"error": "File not found"}