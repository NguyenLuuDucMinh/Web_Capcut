# backend/app/api/upload.py

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
# Sửa lại import JSONResponse
from fastapi.responses import FileResponse, JSONResponse
import shutil
import os
import uuid
import logging
import aiofiles
# Đảm bảo import đúng đường dẫn tới hàm process_video
try:
    from app.services.video_processing import process_video
except ImportError:
    import sys
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    if project_root not in sys.path:
        sys.path.append(project_root)
    from app.services.video_processing import process_video

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["Video Processing"]
)

# --- Định nghĩa các thư mục một cách rõ ràng hơn ---
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "temp_uploads")
OUTPUT_DIR = os.path.join(BACKEND_ROOT, "temp_outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
logger.info(f"Absolute Upload directory: {os.path.abspath(UPLOAD_DIR)}")
logger.info(f"Absolute Output directory: {os.path.abspath(OUTPUT_DIR)}")


# --- Endpoint để Upload và Xử lý ---
@router.post("/upload")
async def upload_and_process_files(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Audio file (MP3, WAV, etc.)"),
    srt: UploadFile = File(..., description="SRT subtitle file"),
    videos: list[UploadFile] = File(..., description="List of short video clips")
):
    """
    Uploads audio, SRT, and video files, then processes them
    in the background to generate a combined video.
    (Endpoint: /api/upload)
    """
    session_id = str(uuid.uuid4())
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)
    logger.info(f"Created session upload directory: {session_upload_dir}")

    saved_audio_path = ""
    saved_srt_path = ""
    saved_video_paths = []
    files_to_cleanup_on_error = [session_upload_dir]

    try:
        # --- Save audio asynchronously ---
        safe_audio_filename = f"audio_{session_id}_{audio.filename}"
        saved_audio_path = os.path.abspath(os.path.join(session_upload_dir, safe_audio_filename))
        async with aiofiles.open(saved_audio_path, "wb") as f:
            content = await audio.read()
            await f.write(content)
        logger.info(f"Saved audio file: {saved_audio_path}")
        files_to_cleanup_on_error.append(saved_audio_path)

        # --- Save srt asynchronously ---
        safe_srt_filename = f"srt_{session_id}_{srt.filename}"
        saved_srt_path = os.path.abspath(os.path.join(session_upload_dir, safe_srt_filename))
        async with aiofiles.open(saved_srt_path, "wb") as f:
            content = await srt.read()
            await f.write(content)
        logger.info(f"Saved SRT file: {saved_srt_path}")
        files_to_cleanup_on_error.append(saved_srt_path)

        # --- Save all video files asynchronously ---
        if not videos:
            raise HTTPException(status_code=400, detail="Không có file video nào được tải lên.")

        for video in videos:
            if not video.filename:
                 logger.warning("Received a video upload without a filename, skipping.")
                 continue
            safe_video_filename = f"video_{uuid.uuid4()}_{video.filename}"
            video_path = os.path.abspath(os.path.join(session_upload_dir, safe_video_filename))
            async with aiofiles.open(video_path, "wb") as f:
                content = await video.read()
                await f.write(content)
            saved_video_paths.append(video_path)
            logger.info(f"Saved video file: {video_path}")
            files_to_cleanup_on_error.append(video_path)

        if not saved_video_paths:
             raise HTTPException(status_code=400, detail="Không thể lưu file video hoặc không có video hợp lệ.")

        # --- Define final output path (absolute path) ---
        output_filename = f"output_{session_id}.mp4"
        final_output_path = os.path.abspath(os.path.join(OUTPUT_DIR, output_filename))

        # --- Run processing in background ---
        logger.info(f"Scheduling background task 'process_video' with correct parameters...")
        # ... (log các path như trước) ...
        background_tasks.add_task(
            process_video,
            saved_audio_path,
            saved_video_paths,
            saved_srt_path,
            final_output_path
        )

        # --- Return 202 Accepted response ---
        # Sử dụng JSONResponse để đặt status code là 202
        return JSONResponse(
            status_code=202, # Explicitly set 202 Accepted
            content={
                "message": "Yêu cầu xử lý video đã được nhận và đang chạy ngầm.",
                "detail": "Quá trình có thể mất vài phút. Vui lòng đợi...",
                "output_filename": output_filename
            }
        )

    except Exception as e:
        logger.exception("Error during file saving or task scheduling.")
        cleanup_files_sync(files_to_cleanup_on_error)
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ nội bộ khi chuẩn bị xử lý: {e}")


# --- Endpoint để kiểm tra trạng thái file ---
@router.get("/check/{file_name}")
async def check_file_status(file_name: str):
    """
    Checks if the generated output file exists and is ready.
    """
    logger.info(f"Checking status for filename: {file_name}")
    if ".." in file_name or file_name.startswith(("/", "\\")):
        logger.warning(f"Invalid filename check attempt: {file_name}")
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")

    file_path = os.path.abspath(os.path.join(OUTPUT_DIR, file_name))
    logger.info(f"Checking existence of: {file_path}")

    if os.path.exists(file_path) and os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
        logger.info(f"File {file_name} exists and is ready.")
        return {"ready": True, "filename": file_name}
    else:
        # Log chi tiết hơn lý do chưa sẵn sàng
        if not os.path.exists(file_path):
             logger.info(f"File {file_name} not found yet.")
        elif not os.path.isfile(file_path):
             logger.warning(f"Path exists but is not a file: {file_path}")
        else: # File tồn tại nhưng size = 0
             logger.warning(f"File {file_name} exists but size is 0. Assuming not ready.")
        return {"ready": False, "filename": file_name}


# --- Endpoint để Download file kết quả ---
@router.get("/download/{file_name}")
async def download_file(file_name: str):
    """
    Downloads the generated video file.
    """
    # ... (Code download như phiên bản trước, đã có log và kiểm tra) ...
    logger.info(f"Received download request for filename: {file_name}")
    logger.info(f"OUTPUT_DIR used in download endpoint: {os.path.abspath(OUTPUT_DIR)}")
    if ".." in file_name or file_name.startswith(("/", "\\")):
        logger.warning(f"Attempted directory traversal: {file_name}")
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")
    file_path = os.path.abspath(os.path.join(OUTPUT_DIR, file_name))
    logger.info(f"Attempting to serve file from absolute path: {file_path}")
    if os.path.exists(file_path) and os.path.isfile(file_path):
        logger.info(f"File found. Returning FileResponse for: {file_path}")
        return FileResponse(path=file_path, media_type='video/mp4', filename=file_name)
    else:
        if not os.path.exists(file_path): logger.error(f"File does NOT exist at path: {file_path}")
        elif not os.path.isfile(file_path): logger.error(f"Path exists but is NOT a file: {file_path}")
        raise HTTPException(status_code=404, detail="Không tìm thấy file được yêu cầu.")


# --- Endpoint để liệt kê file kết quả ---
@router.get("/results")
async def list_results():
    """
    Lists the files currently available in the output directory.
    """
    # ... (Code list_results như phiên bản trước) ...
    logger.info(f"Listing results from directory: {os.path.abspath(OUTPUT_DIR)}")
    try:
        files = [f for f in os.listdir(OUTPUT_DIR) if os.path.isfile(os.path.join(OUTPUT_DIR, f))]
        files.sort(key=lambda f: os.path.getmtime(os.path.join(OUTPUT_DIR, f)), reverse=True)
        return {"results": files}
    except Exception as e:
        logger.error(f"Error listing results directory '{OUTPUT_DIR}': {e}")
        raise HTTPException(status_code=500, detail="Không thể liệt kê file kết quả.")


# --- Hàm tiện ích để dọn dẹp file (ĐỒNG BỘ) ---
def cleanup_files_sync(paths_to_delete: list[str]):
    """Synchronous utility function to delete files/folders."""
    # ... (Code cleanup_files_sync như phiên bản trước) ...
    logger.info(f"Cleanup task (sync) started for: {paths_to_delete}")
    for path in paths_to_delete:
        try:
            abs_path = os.path.abspath(path)
            if not abs_path or not os.path.exists(abs_path): continue
            if os.path.isdir(abs_path): shutil.rmtree(abs_path); logger.info(f"Removed directory and contents: {abs_path}")
            else: os.remove(abs_path); logger.info(f"Removed file: {abs_path}")
        except Exception as e: logger.error(f"Error during sync cleanup of path '{path}' (absolute: '{abs_path}'): {e}", exc_info=True)