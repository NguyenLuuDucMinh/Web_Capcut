// src/app/upload/uploadForm/page.tsx
'use client';

import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FiUploadCloud, FiFile, FiVideo, FiList, FiX, FiLoader, FiAlertCircle, FiCheckCircle, FiArrowLeft, FiDownload, FiTrash2 } from 'react-icons/fi';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const POLLING_INTERVAL = 5000; // 5 giây
const POLLING_TIMEOUT = 300000; // 5 phút

export default function UploadFormPage() {
  // --- State Variables ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);
  const [processingFilename, setProcessingFilename] = useState<string | null>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [pollingTimeoutId, setPollingTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // --- Refs ---
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  // --- Hàm dừng polling ---
  const stopPolling = () => {
    if (pollingIntervalId) { clearInterval(pollingIntervalId); setPollingIntervalId(null); console.log("Polling stopped."); }
    if (pollingTimeoutId) { clearTimeout(pollingTimeoutId); setPollingTimeoutId(null); console.log("Polling timeout cleared."); }
  };

  // --- Hàm reset các state liên quan đến kết quả/lỗi ---
   const resetStates = () => {
        setError(null);
        setStatusMessage('');
        setResultDownloadUrl(null);
        setProcessingFilename(null);
        stopPolling();
   }

  // --- Event Handlers ---
  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) { setAudioFile(e.target.files[0]); resetStates(); }
  };
  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesToAdd = Array.from(e.target.files as FileList);
      setVideoFiles((prev) => [...prev, ...filesToAdd]); resetStates();
      if (e.target) e.target.value = '';
    }
  };
  const handleSrtChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) { setSrtFile(e.target.files[0]); resetStates(); }
  };
  const removeVideo = (index: number) => {
    setVideoFiles((prevFiles) => prevFiles.filter((_, i) => i !== index)); resetStates();
  };
  const clearInputs = () => {
    setAudioFile(null); setVideoFiles([]); setSrtFile(null);
    resetStates(); // Reset các trạng thái khác
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (srtInputRef.current) srtInputRef.current.value = '';
    setIsLoading(false); // Cho phép submit lại
  };

  // --- handleSubmit với logic bắt đầu polling ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    stopPolling();
    resetStates();

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
      setStatusMessage('Đang tải file lên...');
      // Gọi API upload (Đảm bảo URL đúng: /api/upload hoặc /api/generate)
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData);

      if (response.status === 202 && response.data.output_filename) {
          const filename = response.data.output_filename;
          setStatusMessage("Đã nhận yêu cầu, đang xử lý video... Vui lòng đợi.");
          setProcessingFilename(filename);
      } else {
           setError(`Phản hồi không mong muốn khi bắt đầu xử lý (Status: ${response.status}, Data: ${JSON.stringify(response.data)})`);
           setStatusMessage('');
           setIsLoading(false);
      }

    } catch (err: any) {
      console.error('Lỗi khi upload:', err);
      if (axios.isAxiosError(err)) {
        if (err.message === 'Network Error') { setError('Không thể kết nối đến máy chủ xử lý.'); }
        else { setError(err.response?.data?.detail || err.message || 'Lỗi upload.'); }
      } else { setError('Lỗi không xác định.'); }
       setStatusMessage('');
       setIsLoading(false);
    }
  };

  // --- useEffect để quản lý polling ---
  useEffect(() => {
    if (processingFilename && !pollingIntervalId) {
        console.log(`Starting polling for ${processingFilename}...`);
        setIsLoading(true);

        const checkStatus = async () => {
            console.log(`Polling check for ${processingFilename}...`);
            try {
                const res = await axios.get(`${BACKEND_URL}/api/check/${processingFilename}`);
                if (res.data.ready === true) {
                    console.log(`File ${processingFilename} is ready! Stopping polling.`);
                    stopPolling();
                    const downloadUrl = `${BACKEND_URL}/api/download/${processingFilename}`;
                    setResultDownloadUrl(downloadUrl);
                    setStatusMessage("Video đã xử lý xong!");
                    setError(null);
                    setProcessingFilename(null);
                    setIsLoading(false);
                } else {
                    console.log(`File ${processingFilename} not ready yet.`);
                }
            } catch (pollError: any) {
                console.error(`Error during polling for ${processingFilename}:`, pollError);
                setError(`Lỗi khi kiểm tra trạng thái: ${axios.isAxiosError(pollError) ? (pollError.response?.data?.detail || pollError.message) : 'Lỗi không xác định'}`);
                stopPolling();
                setProcessingFilename(null);
                setIsLoading(false);
            }
        };

        checkStatus();
        const intervalId = setInterval(checkStatus, POLLING_INTERVAL);
        setPollingIntervalId(intervalId);

        const timeoutId = setTimeout(() => {
            console.error(`Polling timeout reached for ${processingFilename}! Stopping polling.`);
            setError("Quá trình xử lý mất quá nhiều thời gian. Vui lòng thử lại hoặc kiểm tra file kết quả thủ công.");
            stopPolling();
            setProcessingFilename(null);
            setIsLoading(false);
        }, POLLING_TIMEOUT);
        setPollingTimeoutId(timeoutId);

        return () => {
            console.log("Cleanup: Stopping polling if active.");
            stopPolling();
        };
    }
  }, [processingFilename]); // Chạy lại khi processingFilename thay đổi

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
          <div> {/* Div bọc ngoài cho Audio */}
            <label htmlFor="audio" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <FiFile className="inline-block mr-1" /> 1. Chọn File Audio Podcast
            </label>
            <input
              id="audio"
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              required
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              disabled={isLoading || !!processingFilename} // Vô hiệu hóa khi đang loading hoặc polling
            />
            {/* Hiển thị tên file BÊN TRONG div */}
            {audioFile && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Đã chọn: {audioFile.name}</p>
            )}
          </div> {/* Đóng div cho Audio */}

          {/* --- Video Inputs --- */}
          <div> {/* Div bọc ngoài cho Video */}
             <label htmlFor="video" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
               <FiVideo className="inline-block mr-1" /> 2. Thêm các Video Clip ngắn
             </label>
             <input
               id="video"
               ref={videoInputRef}
               type="file"
               accept="video/*"
               multiple
               onChange={handleVideoChange}
               className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 dark:file:bg-green-900 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-100 dark:hover:file:bg-green-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
               disabled={isLoading || !!processingFilename} // Vô hiệu hóa khi đang loading hoặc polling
             />
             {/* Hiển thị danh sách video BÊN TRONG div */}
             {videoFiles.length > 0 && (
               <div className="mt-3 space-y-2">
                 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Video đã chọn ({videoFiles.length}):</p>
                 <ul className="list-none p-2 border dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                   {videoFiles.map((file, index) => {
                     const uniqueKey = `${file.name}-${file.lastModified}-${index}`;
                     return (
                       <li key={uniqueKey} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300 py-1 border-b dark:border-gray-600 last:border-b-0">
                         <span>{file.name}</span>
                         <button
                           type="button"
                           onClick={() => removeVideo(index)}
                           // Vô hiệu hóa nút xóa khi đang xử lý để tránh thay đổi state
                           className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900"
                           disabled={isLoading || !!processingFilename}
                           title="Xóa video này"
                         >
                           <FiX size={14} />
                         </button>
                       </li>
                     );
                   })}
                 </ul>
               </div>
             )}
           </div> {/* Đóng div cho Video */}


          {/* --- SRT Input --- */}
          <div> {/* Div bọc ngoài cho SRT */}
            <label htmlFor="srt" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <FiList className="inline-block mr-1" /> 3. Chọn File Phụ đề (.srt)
            </label>
            <input
              id="srt"
              ref={srtInputRef}
              type="file"
              accept=".srt"
              onChange={handleSrtChange}
              required
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 dark:file:bg-yellow-900 file:text-yellow-700 dark:file:text-yellow-300 hover:file:bg-yellow-100 dark:hover:file:bg-yellow-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              disabled={isLoading || !!processingFilename} // Vô hiệu hóa khi đang loading hoặc polling
            />
            {/* Hiển thị tên file BÊN TRONG div */}
            {srtFile && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Đã chọn: {srtFile.name}</p>
            )}
          </div> {/* Đóng div cho SRT */}

          {/* --- Submit & Clear Buttons --- */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
             {/* Vô hiệu hóa nút submit khi loading HOẶC đang polling */}
             <button
               type="submit"
               disabled={isLoading || !!processingFilename || !audioFile || videoFiles.length === 0 || !srtFile}
               className="w-full sm:w-auto flex-grow px-6 py-3 text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center justify-center"
             >
               {isLoading ? (
                 <> <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> {processingFilename ? 'Đang xử lý...' : 'Đang tải lên...'} </>
               ) : ( 'Bắt đầu Tạo Video' )}
             </button>
             {/* Vô hiệu hóa nút Clear khi đang loading/polling */}
             <button
               type="button"
               onClick={clearInputs}
               disabled={isLoading || !!processingFilename}
               className="w-full sm:w-auto px-6 py-3 text-sm text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <FiTrash2 className="mr-2 h-5 w-5" /> Xóa lựa chọn
             </button>
          </div>

          {/* --- Status/Error/Download Messages --- */}
           <div className="mt-6 space-y-3 min-h-[50px]"> {/* Giữ chiều cao tối thiểu để tránh nhảy layout */}
               {/* Download Link (Ưu tiên hiển thị) */}
               {resultDownloadUrl && !isLoading && !processingFilename && (
                 <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 rounded-lg text-center">
                   <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center justify-center gap-2">
                     <FiCheckCircle className="h-6 w-6" /> Video Sẵn Sàng!
                   </h3>
                   <a
                     href={resultDownloadUrl}
                     download
                     className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
                   >
                     <FiDownload className="mr-2 h-5 w-5" />
                     Tải Video Xuống
                   </a>
                 </div>
               )}

               {/* Processing Message (Hiển thị khi đang polling và chưa có link/lỗi) */}
               {isLoading && processingFilename && !resultDownloadUrl && !error && (
                   <div className="p-3 text-sm text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-md flex items-center justify-center">
                       <FiLoader className="animate-spin mr-2" size={18}/>
                       <span>{statusMessage || 'Đang xử lý video, vui lòng đợi...'}</span>
                   </div>
               )}

               {/* Initial/Success Status Message (Không loading, không polling, không link, không lỗi) */}
               {statusMessage && !isLoading && !processingFilename && !resultDownloadUrl && !error && (
                   <div className="p-3 text-sm text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-md flex items-center justify-center">
                       <FiCheckCircle className="mr-2 text-green-500" size={18}/>
                       <span>{statusMessage}</span>
                   </div>
               )}

               {/* Error Message (Ưu tiên hiển thị lỗi) */}
               {error && (
                 <div className="p-3 text-sm text-center text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md flex items-center justify-center">
                   <FiAlertCircle className="mr-2" size={18}/>
                   <span>Lỗi: {error}</span>
                 </div>
               )}

               {/* Link to results (Hiển thị khi đang xử lý hoặc khi có lỗi timeout) */}
               {(isLoading && processingFilename || (error && error.includes('thời gian'))) && (
                  <div className="mt-4 p-3 text-xs text-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                     Quá trình xử lý diễn ra ngầm... Bạn có thể kiểm tra file tại: {' '}
                     <a href={`${BACKEND_URL}/api/results`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Xem file đã tạo</a>
                  </div>
               )}
           </div>
         </form>
       </div>
    </main>
  );
}