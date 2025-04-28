# backend/app/services/video_processing.py

import ffmpeg
import os
import math
import tempfile
from typing import List

def concatenate_videos(video_paths: List[str], target_duration: float) -> str:
    """
    Ghép nối các video lại với nhau cho đến khi tổng thời lượng >= target_duration (giây).
    """
    # Tạo 1 list video cần lặp lại
    input_videos = []
    total_duration = 0.0

    # Tính tổng duration các video ban đầu
    video_durations = []
    for path in video_paths:
        probe = ffmpeg.probe(path)
        duration = float(probe['format']['duration'])
        video_durations.append(duration)

    # Lặp các video cho đến khi đủ thời lượng
    while total_duration < target_duration:
        for idx, path in enumerate(video_paths):
            input_videos.append(path)
            total_duration += video_durations[idx]
            if total_duration >= target_duration:
                break

    # Ghi vào 1 file list.txt để ffmpeg concat
    list_file = tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.txt')
    for video in input_videos:
        list_file.write(f"file '{os.path.abspath(video)}'\n")
    list_file.close()

    output_path = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4').name

    # Ghép file bằng concat
    ffmpeg.input(list_file.name, format='concat', safe=0).output(output_path, c='copy').run(overwrite_output=True)

    # Xóa file tạm list.txt
    os.unlink(list_file.name)

    return output_path

def add_audio_to_video(video_path: str, audio_path: str, output_path: str) -> None:
    """
    Gán audio vào video.
    """
    (
        ffmpeg
        .input(video_path)
        .output(audio_path)
    )
    
    video = ffmpeg.input(video_path)
    audio = ffmpeg.input(audio_path)

    (
        ffmpeg
        .output(video.video, audio.audio, output_path, vcodec='copy', acodec='aac', strict='experimental')
        .run(overwrite_output=True)
    )

def add_subtitles(video_path: str, srt_path: str, output_path: str) -> None:
    """
    Thêm phụ đề SRT vào video.
    """
    (
        ffmpeg
        .input(video_path)
        .output(
            output_path,
            vf=f"subtitles='{srt_path}':force_style='FontName=Arial,FontSize=24,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=1'",
            c='copy'
        )
        .run(overwrite_output=True)
    )

def process_video(audio_path: str, video_paths: List[str], srt_path: str, output_path: str) -> str:
    """
    Hàm chính: Ghép các video, thêm audio và phụ đề.
    """
    # 1. Lấy duration file audio
    probe_audio = ffmpeg.probe(audio_path)
    audio_duration = float(probe_audio['format']['duration'])

    # 2. Ghép video đủ dài
    concatenated_video = concatenate_videos(video_paths, target_duration=audio_duration)

    # 3. Gán audio vào video
    temp_with_audio = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4').name
    add_audio_to_video(concatenated_video, audio_path, temp_with_audio)

    # 4. Thêm phụ đề
    add_subtitles(temp_with_audio, srt_path, output_path)

    # Xóa file tạm
    os.unlink(concatenated_video)
    os.unlink(temp_with_audio)

    return output_path
