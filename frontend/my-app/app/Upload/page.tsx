// src/app/upload/uploadForm/page.tsx
'use client';

import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react'; // Bỏ useCallback nếu không dùng phức tạp
import axios from 'axios';
import Link from 'next/link';
// Thêm FiDownload cho nút tải xuống
import { FiUploadCloud, FiFile, FiVideo, FiList, FiX, FiLoader, FiAlertCircle, FiCheckCircle, FiArrowLeft, FiDownload, FiTrash2 } from 'react-icons/fi'; // Thêm FiDownload, FiTrash2

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function UploadFormPage() {
  // --- State Variables ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  // *** Thêm state để lưu URL download ***
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);

  // --- Refs for File Inputs ---
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  // --- Event Handlers ---
  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setError(null); setStatusMessage(''); setResultDownloadUrl(null); // Reset download link
    }
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesToAdd = Array.from(e.target.files as FileList);
      setVideoFiles((prev) => [...prev, ...filesToAdd]);
      setError(null); setStatusMessage(''); setResultDownloadUrl(null); // Reset download link
      if (e.target) e.target.value = '';
    }
  };

  const handleSrtChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSrtFile(e.target.files[0]);
      setError(null); setStatusMessage(''); setResultDownloadUrl(null); // Reset download link
    }
  };

  const removeVideo = (index: number) => {
    setVideoFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    setResultDownloadUrl(null); // Reset download link
  };

  const clearInputs = () => {
      setAudioFile(null); setVideoFiles([]); setSrtFile(null);
      setError(null); setStatusMessage(''); setResultDownloadUrl(null); // Reset download link
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (srtInputRef.current) srtInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setStatusMessage(''); setResultDownloadUrl(null); // Reset download link khi submit mới

    if (!audioFile || videoFiles.length === 0 || !srtFile) {
      setError('Vui lòng chọn đủ file Audio, ít nhất 1 Video, và file SRT.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', audioFile);
    videoFiles.forEach((video) => formData.append('videos', video));
    formData.append('srt', srtFile);

    try {
      setStatusMessage('Đang tải file lên và bắt đầu xử lý...');

      // *** SỬA LẠI URL API THÀNH /api/generate ***
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
        headers: { },
      });

      // *** SỬA LẠI LOGIC XỬ LÝ PHẢN HỒI THÀNH CÔNG ***
      // Chấp nhận status 200 (OK) hoặc 202 (Accepted) và kiểm tra có output_filename không
      if ((response.status === 200 || response.status === 202) && response.data.output_filename) {
          const filename = response.data.output_filename;
          // Tạo URL download đầy đủ
          const downloadUrl = `${BACKEND_URL}/api/download/${filename}`;
          setResultDownloadUrl(downloadUrl); // Lưu URL vào state
          // Có thể đặt statusMessage thành công hoặc để trống vì đã có nút download
          setStatusMessage("Video đã được xử lý thành công!");
          console.log("Download URL generated:", downloadUrl);
      } else {
           // Xử lý các trường hợp phản hồi không mong muốn hoặc thiếu output_filename
           setError(`Phản hồi từ server không hợp lệ (Status: ${response.status}, Data: ${JSON.stringify(response.data)})`);
           setStatusMessage('');
      }

    } catch (err: any) {
      console.error('Lỗi khi upload hoặc xử lý file:', err);
      if (axios.isAxiosError(err)) {
        // Kiểm tra nếu là lỗi mạng (backend không chạy?)
        if (err.message === 'Network Error') {
             setError('Không thể kết nối đến máy chủ xử lý. Vui lòng thử lại sau hoặc kiểm tra trạng thái server.');
        } else {
             setError(err.response?.data?.detail || err.message || 'Lỗi upload/xử lý.');
        }
      } else {
        setError('Lỗi không xác định.');
      }
       setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // --- useEffect (giữ nguyên để debug nếu cần) ---
  useEffect(() => {
      // console.log('Current audioFile state (useEffect):', audioFile);
  }, [audioFile]);
  useEffect(() => {
      // console.log('Current videoFiles state (useEffect):', videoFiles);
  }, [videoFiles]);
  useEffect(() => {
      // console.log('Current srtFile state (useEffect):', srtFile);
  }, [srtFile]);

  // --- JSX Rendering ---
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 md:p-12 bg-gray-50 dark:bg-gray-900">
       <div className="w-full max-w-3xl mb-4">
            <Link href="/" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                <FiArrowLeft className="mr-1" />
                Quay lại Trang chủ
            </Link>
       </div>

      <div className="w-full max-w-3xl p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
          <FiUploadCloud className="inline-block mr-2 mb-1" /> Tải lên và Tạo Video
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* --- Audio Input --- */}
          <div>
            <label htmlFor="audio" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <FiFile className="inline-block mr-1" /> 1. Chọn File Audio Podcast
            </label>
            <input id="audio" ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioChange} required className="block w-full ..." disabled={isLoading} />
            {audioFile && (<p className="mt-2 text-xs ...">Đã chọn: {audioFile.name}</p>)}
          </div>

          {/* --- Video Inputs --- */}
          <div>
             <label htmlFor="video" className="block text-sm font-semibold ...">
               <FiVideo className="inline-block mr-1" /> 2. Thêm các Video Clip ngắn
             </label>
             <input id="video" ref={videoInputRef} type="file" accept="video/*" multiple onChange={handleVideoChange} className="block w-full ..." disabled={isLoading} />
             {videoFiles.length > 0 && (
               <div className="mt-3 space-y-2">
                 <p className="text-sm font-medium ...">Video đã chọn ({videoFiles.length}):</p>
                 <ul className="list-none p-2 border ...">
                   {videoFiles.map((file, index) => {
                     const uniqueKey = `${file.name}-${file.lastModified}-${index}`;
                     // console.log('Mapping video file:', file.name, 'with key:', uniqueKey);
                     return (
                       <li key={uniqueKey} className="flex justify-between items-center ...">
                         <span>{file.name}</span>
                         <button type="button" onClick={() => removeVideo(index)} className="ml-2 ..." disabled={isLoading} title="Xóa video này">
                           <FiX size={14} />
                         </button>
                       </li>
                     );
                   })}
                 </ul>
               </div>
             )}
           </div>

          {/* --- SRT Input --- */}
          <div>
            <label htmlFor="srt" className="block text-sm font-semibold ...">
              <FiList className="inline-block mr-1" /> 3. Chọn File Phụ đề (.srt)
            </label>
            <input id="srt" ref={srtInputRef} type="file" accept=".srt" onChange={handleSrtChange} required className="block w-full ..." disabled={isLoading} />
            {srtFile && (<p className="mt-2 text-xs ...">Đã chọn: {srtFile.name}</p>)}
          </div>

          {/* --- Submit & Clear Buttons --- */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
             <button type="submit" disabled={isLoading || !audioFile || videoFiles.length === 0 || !srtFile} className="w-full sm:w-auto flex-grow ...">
               {isLoading ? ( <> <FiLoader className="animate-spin ..." /> Đang xử lý... </> ) : ( 'Bắt đầu Tạo Video' )}
             </button>
             {/* Đã thêm FiTrash2 vào import */}
             <button type="button" onClick={clearInputs} disabled={isLoading} className="w-full sm:w-auto ...">
                <FiTrash2 className="mr-2 h-5 w-5" /> Xóa lựa chọn
             </button>
          </div>

          {/* --- Status/Error/Download Messages --- */}
          <div className="mt-6 space-y-3">
              {/* Download Link (Ưu tiên hiển thị nếu có) */}
              {resultDownloadUrl && !isLoading && (
                <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 rounded-lg text-center">
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center justify-center gap-2">
                    <FiCheckCircle className="h-6 w-6" /> Video Sẵn Sàng!
                  </h3>
                  <a
                    href={resultDownloadUrl}
                    download // Quan trọng: để trình duyệt tải về thay vì điều hướng
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
                  >
                    <FiDownload className="mr-2 h-5 w-5" />
                    Tải Video Xuống
                  </a>
                </div>
              )}

              {/* Status Message (Chỉ hiển thị nếu không có lỗi và không có link download) */}
              {statusMessage && !error && !resultDownloadUrl && (
                  <div className="p-3 text-sm text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-md flex items-center justify-center">
                      <FiCheckCircle className="mr-2 text-green-500" size={18}/>
                      <span>{statusMessage}</span>
                  </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 text-sm text-center text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md flex items-center justify-center">
                  <FiAlertCircle className="mr-2" size={18}/>
                  <span>Lỗi: {error}</span>
                </div>
              )}

              {/* Info about background processing (Chỉ hiển thị khi đang loading hoặc có status message và chưa có link/lỗi) */}
              {(isLoading || (statusMessage && !error && !resultDownloadUrl)) && (
                 <div className="mt-4 p-3 text-xs text-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    Quá trình xử lý video diễn ra ngầm... Bạn có thể kiểm tra file tại: {' '}
                    <a href={`${BACKEND_URL}/api/results`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                        Xem file đã tạo
                    </a>
                 </div>
              )}
          </div>
        </form>
      </div>
    </main>
  );
}