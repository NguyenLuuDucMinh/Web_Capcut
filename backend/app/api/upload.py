# backend/app/api/upload.py

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException # Thêm HTTPException
from fastapi.responses import FileResponse
# Đảm bảo import đúng đường dẫn tới hàm process_video
try:
    # Thử import theo cấu trúc thông thường
    from app.services.video_processing import process_video
except ImportError:
    # Nếu thất bại, thử import từ thư mục cha (hữu ích khi chạy trực tiếp file này)
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..')) # Thêm thư mục cha vào path
    from services.video_processing import process_video

import shutil
import os
import uuid
import logging # Thêm logging
import aiofiles # Sử dụng aiofiles cho lưu file async

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api", # Thêm prefix /api cho tất cả các route trong router này
    tags=["Video Processing"] # Thêm tag cho Swagger UI
)

# Định nghĩa các thư mục (nên lấy từ biến môi trường hoặc config)
UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "temp_outputs"
# TEMP_DIR được định nghĩa trong video_processing.py, không cần ở đây

# Tạo các thư mục nếu chưa tồn tại
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# --- Endpoint để Upload và Xử lý ---
# Đổi route thành /generate để khớp với frontend hoặc sửa frontend thành /upload
@router.post("/upload")
async def generate_video_endpoint(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Audio file (MP3, WAV, etc.)"),
    srt: UploadFile = File(..., description="SRT subtitle file"),
    videos: list[UploadFile] = File(..., description="List of short video clips")
):
    """
    Uploads audio, SRT, and video files, then processes them
    in the background to generate a combined video.
    """
    session_id = str(uuid.uuid4())
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)
    logger.info(f"Created session upload directory: {session_upload_dir}")

    saved_audio_path = ""
    saved_srt_path = ""
    saved_video_paths = []
    files_to_cleanup_on_error = [session_upload_dir] # Luôn xóa thư mục session

    try:
        # --- Save audio asynchronously ---
        # Thêm UUID vào tên file để tránh trùng lặp nếu tên giống nhau
        safe_audio_filename = f"audio_{session_id}_{audio.filename}"
        saved_audio_path = os.path.join(session_upload_dir, safe_audio_filename)
        async with aiofiles.open(saved_audio_path, "wb") as f:
            content = await audio.read() # Đọc nội dung file async
            await f.write(content)      # Ghi nội dung file async
        logger.info(f"Saved audio file: {saved_audio_path}")
        files_to_cleanup_on_error.append(saved_audio_path) # Thêm vào list xóa nếu lỗi

        # --- Save srt asynchronously ---
        safe_srt_filename = f"srt_{session_id}_{srt.filename}"
        saved_srt_path = os.path.join(session_upload_dir, safe_srt_filename)
        async with aiofiles.open(saved_srt_path, "wb") as f:
            content = await srt.read()
            await f.write(content)
        logger.info(f"Saved SRT file: {saved_srt_path}")
        files_to_cleanup_on_error.append(saved_srt_path)

        # --- Save all video files asynchronously ---
        for video in videos:
            safe_video_filename = f"video_{uuid.uuid4()}_{video.filename}" # Thêm UUID cho từng video
            video_path = os.path.join(session_upload_dir, safe_video_filename)
            async with aiofiles.open(video_path, "wb") as f:
                content = await video.read()
                await f.write(content)
            saved_video_paths.append(video_path)
            logger.info(f"Saved video file: {video_path}")
            files_to_cleanup_on_error.append(video_path) # Thêm từng video vào list xóa nếu lỗi

        # --- Define final output path ---
        output_filename = f"output_{session_id}.mp4" # Đặt tên file output theo session_id
        final_output_path = os.path.join(OUTPUT_DIR, output_filename)

        # --- Run processing in background with CORRECT parameter order ---
        logger.info(f"Scheduling background task 'process_video' with:")
        logger.info(f"  audio_path: {saved_audio_path}")
        logger.info(f"  video_paths: {saved_video_paths}")
        logger.info(f"  srt_path: {saved_srt_path}")
        logger.info(f"  output_final_path: {final_output_path}")

        background_tasks.add_task(
            process_video,
            saved_audio_path,      # 1st arg: audio_path
            saved_video_paths,     # 2nd arg: video_paths (list)
            saved_srt_path,        # 3rd arg: srt_path
            final_output_path      # 4th arg: output_final_path
        )

        # --- Return success response (Accepted for background processing) ---
        # Trả về tên file output để frontend có thể dùng để download sau
        return {
            "message": "Yêu cầu xử lý video đã được nhận và đang chạy ngầm.",
            "detail": "Quá trình có thể mất vài phút. Kiểm tra link download sau.",
            "output_filename": output_filename # Trả về tên file để frontend ghép URL download
        }

    except Exception as e:
        logger.exception("Error during file saving or task scheduling.")
        # Nếu có lỗi xảy ra *trước khi* background task chạy, cần dọn dẹp file đã lưu
        cleanup_files(files_to_cleanup_on_error) # Gọi hàm dọn dẹp
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ nội bộ khi chuẩn bị xử lý: {e}")


# --- Endpoint để Download file kết quả ---
@router.get("/download/{file_name}")
async def download_file(file_name: str):
    """
    Downloads the generated video file.
    """
    # Kiểm tra bảo mật cơ bản (ngăn chặn ../)
    if ".." in file_name or file_name.startswith(("/", "\\")):
        logger.warning(f"Attempted directory traversal: {file_name}")
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")

    file_path = os.path.join(OUTPUT_DIR, file_name)
    logger.info(f"Download request for: {file_path}")

    if os.path.exists(file_path):
        # Lưu ý: Không tự động xóa file ngay sau khi download ở đây
        # Nên có cơ chế dọn dẹp riêng (ví dụ: xóa file cũ hơn X ngày)
        return FileResponse(path=file_path, media_type='video/mp4', filename=file_name)
    else:
        logger.error(f"File not found for download: {file_path}")
        raise HTTPException(status_code=404, detail="Không tìm thấy file được yêu cầu.")

# --- Endpoint để liệt kê file kết quả (hữu ích cho debug/kiểm tra) ---
@router.get("/results")
async def list_results():
    """
    Lists the files currently available in the output directory.
    """
    try:
        files = [f for f in os.listdir(OUTPUT_DIR) if os.path.isfile(os.path.join(OUTPUT_DIR, f))]
        # Sắp xếp theo thời gian sửa đổi, mới nhất lên đầu (tùy chọn)
        files.sort(key=lambda f: os.path.getmtime(os.path.join(OUTPUT_DIR, f)), reverse=True)
        return {"results": files}
    except Exception as e:
        logger.error(f"Error listing results directory '{OUTPUT_DIR}': {e}")
        raise HTTPException(status_code=500, detail="Không thể liệt kê file kết quả.")


# --- Hàm tiện ích để dọn dẹp file (có thể đặt trong utils) ---
def cleanup_files(paths_to_delete: list[str]):
    """Utility function to delete files/folders."""
    logger.info(f"Cleanup task started for: {paths_to_delete}")
    for path in paths_to_delete:
        try:
            if not path or not os.path.exists(path): # Kiểm tra path hợp lệ và tồn tại
                continue
            if os.path.isdir(path):
                shutil.rmtree(path) # Xóa thư mục và nội dung
                logger.info(f"Removed directory and contents: {path}")
            else:
                os.remove(path) # Xóa file
                logger.info(f"Removed file: {path}")
        except Exception as e:
            logger.error(f"Error during cleanup of {path}: {e}", exc_info=True) # Log cả traceback