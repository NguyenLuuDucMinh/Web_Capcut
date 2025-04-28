# backend/app/services/video_processing.py

import ffmpeg
import os
import math
import tempfile
import uuid # Thêm uuid
import logging # Thêm logging
from typing import List

# --- Cấu hình Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Thư mục tạm (có thể cấu hình qua env) ---
TEMP_DIR = "temp_files"
os.makedirs(TEMP_DIR, exist_ok=True)

def _escape_path_for_ffmpeg_filter(path: str) -> str:
    """Chuẩn hóa và escape đường dẫn cho filter ffmpeg (ví dụ: subtitles)."""
    # Thay \ bằng /
    path = os.path.abspath(path).replace('\\', '/')
    # Escape các ký tự đặc biệt cơ bản: ':', '\' (đã thay), '[' , ']'
    # Lưu ý: Dấu nháy đơn (') khó escape hơn, tránh dùng trong tên file SRT nếu có thể
    path = path.replace(':', '\\:')
    path = path.replace('[', '\\[')
    path = path.replace(']', '\\]')
    # path = path.replace("'", "'\\\\\\''") # Escape dấu nháy đơn rất phức tạp, nên tránh
    return path


def concatenate_videos(video_paths: List[str], target_duration: float) -> str:
    """
    Ghép nối các video, bỏ qua file lỗi khi probe.
    Trả về đường dẫn file tạm đã ghép.
    """
    input_videos_for_concat = []
    video_durations = []
    total_processed_duration = 0.0
    processed_video_paths = [] # Lưu các đường dẫn file hợp lệ đã probe

    # --- Probe từng file video và tính tổng duration ---
    for path in video_paths:
        abs_path = os.path.abspath(path)
        logger.info(f"Probing video file: {abs_path}")
        try:
            probe = ffmpeg.probe(abs_path)
            duration = float(probe['format']['duration'])
            if duration <= 0:
                logger.warning(f"Video {abs_path} has zero or negative duration. Skipping.")
                continue

            video_durations.append(duration)
            processed_video_paths.append(abs_path) # Lưu đường dẫn tuyệt đối đã probe thành công
            logger.info(f"Successfully probed {abs_path}, duration: {duration}")

        except ffmpeg.Error as e:
            logger.error(f"ffmpeg.probe error for file: {abs_path}")
            logger.error(f"ffprobe stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
            logger.error(f"ffprobe stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
            logger.warning(f"Skipping video file due to probe error: {abs_path}")
            continue # Bỏ qua file lỗi
        except Exception as e:
            logger.exception(f"Unexpected error probing video file: {abs_path}")
            logger.warning(f"Skipping video file due to unexpected error: {abs_path}")
            continue

    if not processed_video_paths:
        raise ValueError("No valid video files could be processed after probing.")

    # Tính tổng duration của các file hợp lệ
    single_loop_duration = sum(video_durations)
    if single_loop_duration <= 0:
         raise ValueError("Total duration of valid videos is zero or negative.")

    # --- Lặp các video hợp lệ cho đến khi đủ thời lượng ---
    current_total_duration = 0.0
    while current_total_duration < target_duration:
        for idx, path in enumerate(processed_video_paths):
            input_videos_for_concat.append(path) # Thêm đường dẫn tuyệt đối
            current_total_duration += video_durations[idx]
            if current_total_duration >= target_duration:
                break

    # --- Ghi vào file list.txt ---
    list_filename = os.path.join(TEMP_DIR, f"concat_list_{uuid.uuid4()}.txt")
    temp_concat_output = os.path.join(TEMP_DIR, f"concat_output_{uuid.uuid4()}.mp4")

    try:
        logger.info(f"Creating concat list file: {list_filename}")
        with open(list_filename, 'w', encoding='utf-8') as list_file: # Thêm encoding='utf-8'
            for video_path in input_videos_for_concat:
                # Đảm bảo đường dẫn là tuyệt đối và dùng /
                safe_video_path = video_path.replace('\\', '/')
                list_file.write(f"file '{safe_video_path}'\n")

        logger.info(f"Running ffmpeg concat operation. Output: {temp_concat_output}")
        # --- Ghép file bằng concat demuxer (yêu cầu các file tương thích) ---
        # Sử dụng c='copy' nhanh nhưng dễ lỗi nếu codec/resolution/fps khác nhau.
        # Cân nhắc bỏ c='copy' để ffmpeg tự encode lại (chậm hơn, an toàn hơn).
        (
            ffmpeg
            .input(list_filename, format='concat', safe=0, ignore_chapters=1)
            .output(temp_concat_output, c='copy') # BỎ c='copy' NẾU CÁC VIDEO KHÔNG TƯƠNG THÍCH
            .run(overwrite_output=True, capture_stdout=True, capture_stderr=True) # Bắt cả stdout/stderr
        )
        logger.info(f"Concatenation successful for: {temp_concat_output}")
        return temp_concat_output

    except ffmpeg.Error as e:
        logger.error(f"ffmpeg concat error using list {list_filename}")
        logger.error(f"ffmpeg stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
        logger.error(f"ffmpeg stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
        # Xóa file output tạm nếu concat lỗi
        if os.path.exists(temp_concat_output):
            os.unlink(temp_concat_output)
        raise ValueError(f"Failed to concatenate videos: {e.stderr.decode('utf-8', errors='ignore')}") from e
    except Exception as e:
        logger.exception(f"Unexpected error during concatenation using list {list_filename}")
         # Xóa file output tạm nếu concat lỗi
        if os.path.exists(temp_concat_output):
            os.unlink(temp_concat_output)
        raise
    finally:
        # --- Xóa file list tạm ---
        if os.path.exists(list_filename):
            try:
                os.unlink(list_filename)
                logger.info(f"Deleted temp concat list: {list_filename}")
            except OSError as unlink_error:
                 logger.error(f"Error deleting temp file {list_filename}: {unlink_error}")


def add_audio_to_video(video_path: str, audio_path: str, output_path: str, target_duration: float) -> None:
    """
    Gán audio vào video, cắt đúng bằng target_duration.
    """
    logger.info(f"Adding audio '{audio_path}' to video '{video_path}' -> '{output_path}' (duration: {target_duration}s)")
    try:
        video_stream = ffmpeg.input(video_path)
        audio_stream = ffmpeg.input(audio_path)

        (
            ffmpeg
            # Chọn luồng video từ video_stream, luồng audio từ audio_stream
            .output(video_stream['v'], audio_stream['a'], output_path,
                    # --- Trim đến target_duration ---
                    t=target_duration,
                    # --- Codecs (KHÔNG dùng 'copy' khi trim/filter) ---
                    vcodec='libx264', # Codec video phổ biến
                    acodec='aac',     # Codec audio phổ biến
                    strict='experimental', # Có thể cần cho aac
                    # --- Tùy chọn chất lượng/tốc độ ---
                    preset='medium',  # Cân bằng tốc độ/chất lượng (ultrafast -> veryslow)
                    crf=23,           # Chất lượng video (18-28, thấp hơn là tốt hơn)
                    shortest=None     # Không dùng shortest khi đã có -t
                   )
            .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
        )
        logger.info(f"Successfully added audio and trimmed video: {output_path}")

    except ffmpeg.Error as e:
        logger.error(f"ffmpeg error adding audio to {video_path}")
        logger.error(f"ffmpeg stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
        logger.error(f"ffmpeg stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
        raise ValueError(f"Failed to add audio: {e.stderr.decode('utf-8', errors='ignore')}") from e
    except Exception as e:
        logger.exception(f"Unexpected error adding audio to {video_path}")
        raise


def add_subtitles(video_path: str, srt_path: str, output_path: str) -> None:
    """
    Thêm phụ đề SRT vào video.
    """
    logger.info(f"Adding subtitles '{srt_path}' to video '{video_path}' -> '{output_path}'")
    # --- Chuẩn hóa đường dẫn SRT cho filter ---
    safe_srt_path = _escape_path_for_ffmpeg_filter(srt_path)
    logger.info(f"Using escaped subtitle path in filter: {safe_srt_path}")

    # --- Style phụ đề (có thể đưa ra ngoài hoặc cấu hình) ---
    # Đã sửa OutlineColour và thêm Alignment, MarginV
    subtitle_style = "FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&HFF000000,BorderStyle=1,Outline=1,Shadow=1,Alignment=2,MarginV=15"

    try:
        (
            ffmpeg
            .input(video_path)
            .output(
                output_path,
                # --- Áp dụng filter phụ đề ---
                # Bỏ c='copy' vì đang dùng filter vf
                vf=f"subtitles='{safe_srt_path}':force_style='{subtitle_style}'",
                # --- Chỉ định lại codec vì không dùng copy ---
                vcodec='libx264', # Hoặc giữ nguyên codec gốc nếu biết
                acodec='aac',     # Giữ nguyên audio
                preset='medium',
                crf=23
            )
            .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
        )
        logger.info(f"Successfully added subtitles: {output_path}")

    except ffmpeg.Error as e:
        logger.error(f"ffmpeg error adding subtitles from {srt_path}")
        logger.error(f"ffmpeg stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
        logger.error(f"ffmpeg stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
        raise ValueError(f"Failed to add subtitles: {e.stderr.decode('utf-8', errors='ignore')}") from e
    except Exception as e:
        logger.exception(f"Unexpected error adding subtitles from {srt_path}")
        raise


def process_video(audio_path: str, video_paths: List[str], srt_path: str, output_final_path: str) -> str:
    """
    Hàm chính: Ghép video, thêm audio, phụ đề và xử lý file tạm.
    """
    temp_files_to_delete = [] # Lưu các file tạm cần xóa

    try:
        # --- 1. Lấy duration file audio ---
        logger.info(f"Probing audio file: {audio_path}")
        probe_audio = ffmpeg.probe(audio_path)
        audio_duration = float(probe_audio['format']['duration'])
        logger.info(f"Audio duration: {audio_duration} seconds")

        # --- 2. Ghép video đủ dài ---
        logger.info("Starting video concatenation...")
        # Hàm concatenate_videos đã xử lý lỗi probe và trả về file tạm
        concatenated_video_temp = concatenate_videos(video_paths, target_duration=audio_duration)
        temp_files_to_delete.append(concatenated_video_temp) # Thêm vào danh sách xóa
        logger.info(f"Temporary concatenated video created: {concatenated_video_temp}")

        # --- 3. Gán audio và cắt video theo duration audio ---
        logger.info("Adding audio and trimming video...")
        # Tạo tên file tạm cho bước này
        temp_with_audio = os.path.join(TEMP_DIR, f"audio_added_{uuid.uuid4()}.mp4")
        add_audio_to_video(concatenated_video_temp, audio_path, temp_with_audio, audio_duration)
        temp_files_to_delete.append(temp_with_audio) # Thêm vào danh sách xóa
        logger.info(f"Temporary video with audio created: {temp_with_audio}")


        # --- 4. Thêm phụ đề vào video đã có audio và đúng độ dài ---
        logger.info("Adding subtitles...")
        # Ghi kết quả cuối cùng vào output_final_path
        add_subtitles(temp_with_audio, srt_path, output_final_path)
        logger.info(f"Final video created successfully: {output_final_path}")

        return output_final_path # Trả về đường dẫn file cuối cùng

    except Exception as main_error:
         # Log lỗi ở hàm chính nếu các hàm con raise lỗi
         logger.exception(f"Error during video processing pipeline: {main_error}")
         # Đảm bảo không trả về đường dẫn output nếu lỗi
         # Cân nhắc raise lại lỗi để background task biết là đã thất bại
         raise main_error # Raise lại lỗi

    finally:
        # --- Dọn dẹp tất cả file tạm đã tạo ---
        logger.info("Cleaning up temporary files...")
        for temp_file in temp_files_to_delete:
            if os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                    logger.info(f"Deleted temp file: {temp_file}")
                except OSError as unlink_error:
                    logger.error(f"Error deleting temp file {temp_file}: {unlink_error}")