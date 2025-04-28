# backend/app/services/video_processing.py

import ffmpeg
import os
import math
import tempfile
import uuid # Thêm uuid
import logging # Thêm logging
from typing import List

# --- Cấu hình Logging ---
# Đảm bảo logging được cấu hình ở mức INFO để thấy các log chi tiết
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Thư mục tạm (có thể cấu hình qua env) ---
# Xác định thư mục gốc của backend để tạo thư mục tạm bên trong đó
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_DIR = os.path.join(BACKEND_ROOT, "temp_files")
os.makedirs(TEMP_DIR, exist_ok=True)
logger.info(f"Temporary files directory: {TEMP_DIR}")

def _escape_path_for_ffmpeg_filter(path: str) -> str:
    """Chuẩn hóa và escape đường dẫn cho filter ffmpeg (ví dụ: subtitles)."""
    path = os.path.abspath(path).replace('\\', '/')
    # Escape ký tự đặc biệt theo yêu cầu của ffmpeg filter syntax
    # Dấu ':' cần escape thành '\\:'
    # Dấu '\' (đã thay bằng '/') không cần nữa
    # Dấu '[' thành '\\['
    # Dấu ']' thành '\\]'
    # Dấu ',' thành '\\,' (nếu dùng trong list file)
    # Dấu "'" là khó nhất, thường cần escape thành "'\\\\\\''" hoặc đơn giản là tránh dùng
    path = path.replace(':', '\\:')
    path = path.replace('[', '\\[')
    path = path.replace(']', '\\]')
    path = path.replace(',', '\\,')
    # Nếu bạn vẫn gặp vấn đề với dấu nháy đơn, hãy thử escape:
    # path = path.replace("'", "'\\\\\\''")
    # Hoặc báo lỗi nếu có dấu nháy đơn trong tên file SRT:
    if "'" in path:
         logger.warning(f"Single quote found in subtitle path '{path}'. This might cause issues with ffmpeg filters.")
         # raise ValueError("Subtitle filename contains a single quote, which is not reliably supported.")
    return path


def concatenate_videos(video_paths: List[str], target_duration: float) -> str:
    """
    Ghép nối các video, bỏ qua file lỗi khi probe.
    Trả về đường dẫn file tạm đã ghép.
    """
    input_videos_for_concat = []
    video_durations = []
    processed_video_paths = [] # Lưu các đường dẫn file hợp lệ đã probe

    # --- Probe từng file video và tính tổng duration ---
    for path in video_paths:
        abs_path = os.path.abspath(path) # Lấy đường dẫn tuyệt đối
        logger.info(f"Probing video file: {abs_path}")
        if not os.path.exists(abs_path):
             logger.error(f"Video file does not exist at path: {abs_path}. Skipping.")
             continue # Bỏ qua nếu file không tồn tại

        try:
            probe = ffmpeg.probe(abs_path)
            # Kiểm tra xem có 'format' và 'duration' không
            if 'format' not in probe or 'duration' not in probe['format']:
                 logger.warning(f"Could not get duration from probe result for {abs_path}. Skipping. Probe data: {probe}")
                 continue
            duration = float(probe['format']['duration'])
            if duration <= 0:
                logger.warning(f"Video {abs_path} has zero or negative duration ({duration}). Skipping.")
                continue

            video_durations.append(duration)
            processed_video_paths.append(abs_path) # Lưu đường dẫn tuyệt đối
            logger.info(f"Successfully probed {abs_path}, duration: {duration}")

        except ffmpeg.Error as e:
            logger.error(f"ffmpeg.probe error for file: {abs_path}")
            logger.error(f"ffprobe stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
            logger.error(f"ffprobe stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
            logger.warning(f"Skipping video file due to probe error: {abs_path}")
            continue # Bỏ qua file lỗi
        except Exception as e:
            # Log lỗi cụ thể hơn
            logger.exception(f"Unexpected error probing video file: {abs_path} - Error: {e}")
            logger.warning(f"Skipping video file due to unexpected error: {abs_path}")
            continue

    if not processed_video_paths:
        raise ValueError("No valid video files could be processed after probing.")

    single_loop_duration = sum(video_durations)
    if single_loop_duration <= 0:
         raise ValueError("Total duration of valid videos is zero or negative.")

    # --- Lặp các video hợp lệ cho đến khi đủ thời lượng ---
    current_total_duration = 0.0
    logger.info(f"Target duration: {target_duration}, Single loop duration: {single_loop_duration}")
    while current_total_duration < target_duration:
        for idx, path in enumerate(processed_video_paths):
            input_videos_for_concat.append(path)
            current_total_duration += video_durations[idx]
            # logger.debug(f"Added video {idx+1}, current total duration: {current_total_duration}") # Debug log
            if current_total_duration >= target_duration:
                break
    logger.info(f"Total videos in concat list: {len(input_videos_for_concat)}")

    # --- Ghi vào file list.txt ---
    list_filename = os.path.join(TEMP_DIR, f"concat_list_{uuid.uuid4()}.txt")
    temp_concat_output = os.path.join(TEMP_DIR, f"concat_output_{uuid.uuid4()}.mp4")

    try:
        logger.info(f"Creating concat list file: {list_filename}")
        with open(list_filename, 'w', encoding='utf-8') as list_file:
            for video_path in input_videos_for_concat:
                # Đảm bảo dùng dấu / cho ffmpeg ngay cả trên Windows
                safe_video_path = video_path.replace('\\', '/')
                list_file.write(f"file '{safe_video_path}'\n")
        logger.info(f"Concat list file content written.")

        logger.info(f"Running ffmpeg concat operation. Output: {temp_concat_output}")
        # --- Ghép file bằng concat demuxer ---
        # Xóa bỏ ignore_chapters=1 vì gây lỗi
        (
            ffmpeg
            .input(list_filename, format='concat', safe=0) # Đã xóa ignore_chapters
            # Quan trọng: Bỏ c='copy' nếu video không tương thích hoàn toàn (codec, res, fps, timebase)
            # Nếu giữ c='copy' mà video không tương thích -> lỗi hoặc video hỏng
            # .output(temp_concat_output, c='copy')
            # Thay bằng encode lại (an toàn hơn, chậm hơn):
            .output(temp_concat_output, vcodec='libx264', acodec='aac', preset='fast') # Dùng preset 'fast' để nhanh hơn
            .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
        )
        logger.info(f"Concatenation successful for: {temp_concat_output}")
        return temp_concat_output

    except ffmpeg.Error as e:
        logger.error(f"ffmpeg concat error using list {list_filename}")
        logger.error(f"ffmpeg stdout: {e.stdout.decode('utf-8', errors='ignore') if e.stdout else 'N/A'}")
        logger.error(f"ffmpeg stderr: {e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'}")
        if os.path.exists(temp_concat_output):
            os.unlink(temp_concat_output)
        raise ValueError(f"Failed to concatenate videos: {e.stderr.decode('utf-8', errors='ignore')}") from e
    except Exception as e:
        logger.exception(f"Unexpected error during concatenation using list {list_filename}")
        if os.path.exists(temp_concat_output):
            os.unlink(temp_concat_output)
        raise
    finally:
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
            .output(video_stream['v'], audio_stream['a'], output_path,
                    t=target_duration,      # Trim/Extend to target duration
                    vcodec='libx264',
                    acodec='aac',
                    strict='experimental',  # Often needed for aac
                    preset='medium',        # Balance speed/quality
                    crf=23,                 # Video quality (lower is better)
                    shortest=None           # Do not use shortest with -t
                   )
             # Bắt buộc phải dùng .global_args('-map', '0:v:0', '-map', '1:a:0') nếu input có nhiều luồng
             # Tuy nhiên, nếu input chỉ có 1 video/1 audio thì ffmpeg-python tự xử lý
            .global_args('-map', '0:v:0', '-map', '1:a:0') # Explicitly map streams
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
    safe_srt_path = _escape_path_for_ffmpeg_filter(srt_path)
    logger.info(f"Using escaped subtitle path in filter: {safe_srt_path}")

    subtitle_style = "FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&HFF000000,BorderStyle=1,Outline=1,Shadow=1,Alignment=2,MarginV=15"

    try:
        # Lấy thông tin luồng audio từ video_path để giữ nguyên codec
        probe = ffmpeg.probe(video_path)
        # Tìm luồng audio đầu tiên
        audio_stream_info = next((stream for stream in probe['streams'] if stream['codec_type'] == 'audio'), None)
        # Xác định audio codec, mặc định là aac nếu không tìm thấy
        original_acodec = audio_stream_info['codec_name'] if audio_stream_info else 'aac'
        logger.info(f"Detected original audio codec: {original_acodec}")

        (
            ffmpeg
            .input(video_path)
            .output(
                output_path,
                vf=f"subtitles='{safe_srt_path}':force_style='{subtitle_style}'",
                # --- Mã hóa lại video, giữ nguyên audio nếu có thể ---
                vcodec='libx264',
                acodec=original_acodec, # Cố gắng giữ nguyên audio codec
                preset='medium',
                crf=23
                # Thêm các tùy chọn khác nếu cần, ví dụ: -map để đảm bảo giữ các luồng
            )
            .global_args('-map', '0') # Map tất cả các luồng từ input 0
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
    temp_files_to_delete = []
    logger.info("--- Starting Video Processing Pipeline ---")
    try:
        # --- 1. Lấy duration file audio ---
        logger.info(f"Step 1: Probing audio file: {audio_path}")
        probe_audio = ffmpeg.probe(audio_path)
        audio_duration = float(probe_audio['format']['duration'])
        logger.info(f"Audio duration: {audio_duration} seconds")

        # --- 2. Ghép video đủ dài ---
        logger.info("Step 2: Starting video concatenation...")
        concatenated_video_temp = concatenate_videos(video_paths, target_duration=audio_duration)
        temp_files_to_delete.append(concatenated_video_temp)
        logger.info(f"Temporary concatenated video created: {concatenated_video_temp}")

        # --- 3. Gán audio và cắt video theo duration audio ---
        logger.info("Step 3: Adding audio and trimming video...")
        temp_with_audio = os.path.join(TEMP_DIR, f"audio_added_{uuid.uuid4()}.mp4")
        add_audio_to_video(concatenated_video_temp, audio_path, temp_with_audio, audio_duration)
        temp_files_to_delete.append(temp_with_audio)
        logger.info(f"Temporary video with audio created: {temp_with_audio}")

        # --- 4. Thêm phụ đề vào video đã có audio và đúng độ dài ---
        logger.info("Step 4: Adding subtitles...")
        add_subtitles(temp_with_audio, srt_path, output_final_path)
        logger.info(f"--- Video Processing Pipeline Completed Successfully ---")
        logger.info(f"Final video available at: {output_final_path}")

        return output_final_path

    except Exception as main_error:
         logger.exception(f"--- Video Processing Pipeline FAILED --- Error: {main_error}")
         # Không cần raise lại lỗi nếu muốn background task hoàn thành (nhưng không thành công)
         # Nếu muốn báo lỗi rõ ràng hơn thì raise main_error
         # raise main_error
         # Trả về một giá trị đặc biệt hoặc None để báo lỗi?
         # Hiện tại đang raise lỗi lên trên.
         raise main_error

    finally:
        # --- Dọn dẹp tất cả file tạm đã tạo ---
        logger.info("--- Cleaning up temporary files ---")
        # Đảo ngược danh sách để xóa file gần nhất trước (tùy chọn)
        # temp_files_to_delete.reverse()
        for temp_file in temp_files_to_delete:
            if os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                    logger.info(f"Deleted temp file: {temp_file}")
                except OSError as unlink_error:
                    logger.error(f"Error deleting temp file {temp_file}: {unlink_error}")