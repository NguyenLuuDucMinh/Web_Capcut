// src/app/upload/uploadForm/page.tsx
'use client'; // Bắt buộc vì chúng ta dùng hooks (useState, useRef) và event handlers

import { useState, useRef, ChangeEvent, FormEvent, useEffect, useCallback } from 'react'; // Thêm useEffect, useCallback nếu cần
import axios from 'axios'; // Thư viện để gọi API
import Link from 'next/link'; // Để tạo link quay về trang chủ (tùy chọn)
import { FiUploadCloud, FiFile, FiVideo, FiList, FiX, FiLoader, FiAlertCircle, FiCheckCircle, FiArrowLeft } from 'react-icons/fi'; // Icons

// Lấy URL backend từ biến môi trường hoặc dùng giá trị mặc định
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function UploadFormPage() {
  // --- State Variables ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // --- Refs for File Inputs ---
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  // --- Event Handlers ---
  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log('handleAudioChange triggered', e.target.files); // LOG 1
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Setting audioFile:', file); // LOG 2
      setAudioFile(file);
      setError(null);
      setStatusMessage('');
    }
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log('handleVideoChange triggered', e.target.files); // LOG 3
    if (e.target.files && e.target.files.length > 0) {
      const filesToAdd = Array.from(e.target.files as FileList);
      console.log('Files to add:', filesToAdd); // LOG 4
      setVideoFiles((prev) => {
          const newState = [...prev, ...filesToAdd];
          console.log('New videoFiles state should be:', newState); // LOG 5
          return newState;
      });
      setError(null);
      setStatusMessage('');
      if (e.target) e.target.value = '';
    }
  };

  const handleSrtChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log('handleSrtChange triggered', e.target.files); // LOG 6
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Setting srtFile:', file); // LOG 7
      setSrtFile(file);
      setError(null);
      setStatusMessage('');
    }
  };

  const removeVideo = (index: number) => {
    console.log('Removing video at index:', index); // Log khi xóa video
    setVideoFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const clearInputs = () => {
      setAudioFile(null);
      setVideoFiles([]);
      setSrtFile(null);
      setError(null);
      setStatusMessage('');
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (srtInputRef.current) srtInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStatusMessage('');

    console.log('Submitting form. Current videoFiles:', videoFiles); // Log state khi submit

    if (!audioFile || videoFiles.length === 0 || !srtFile) {
      setError('Vui lòng chọn đủ file Audio, ít nhất 1 Video, và file SRT.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', audioFile);
    videoFiles.forEach((video, index) => {
      formData.append('videos', video);
    });
    formData.append('srt', srtFile);

    try {
      setStatusMessage('Đang tải file lên và bắt đầu xử lý...');

      // !!! Chú ý: Đường dẫn API đang là /api/upload.
      // Hãy đảm bảo nó khớp với backend của bạn (/api/generate?)
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
        headers: { },
        // timeout: 300000,
      });

      if (response.status === 202) {
          setStatusMessage(`${response.data.message || 'Yêu cầu đã được gửi đi xử lý.'} ${response.data.detail || ''}`);
      } else {
           setError(`Trạng thái phản hồi không mong muốn: ${response.status}`);
           setStatusMessage('');
      }

    } catch (err: any) {
      console.error('Lỗi khi upload hoặc xử lý file:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message || 'Lỗi upload/xử lý.');
      } else {
        setError('Lỗi không xác định.');
      }
       setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // --- useEffect để theo dõi state ---
  useEffect(() => {
      console.log('Current audioFile state (useEffect):', audioFile); // LOG 8
  }, [audioFile]);

  useEffect(() => {
      console.log('Current videoFiles state (useEffect):', videoFiles); // LOG 9
  }, [videoFiles]);

  useEffect(() => {
      console.log('Current srtFile state (useEffect):', srtFile); // LOG 10
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
            <input
              id="audio"
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              required
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              disabled={isLoading}
            />
            {audioFile && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Đã chọn: {audioFile.name}</p>
            )}
          </div>

          {/* --- Video Inputs --- */}
          <div>
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
               disabled={isLoading}
             />
             {/* Hiển thị danh sách video đã chọn */}
             {/* Log để kiểm tra length, không gây lỗi render */}
             {/* {console.log('Checking videoFiles.length:', videoFiles.length)} <-- Đã xóa vì gây lỗi ReactNode */}
             {videoFiles.length > 0 && (
               <div className="mt-3 space-y-2">
                 {/* {console.log('Rendering video list container')} <-- Đã xóa vì gây lỗi ReactNode */}
                 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Video đã chọn ({videoFiles.length}):</p>
                 <ul className="list-none p-2 border dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                   {videoFiles.map((file, index) => { // <-- Sửa map để có thân hàm explicit
                     const uniqueKey = `${file.name}-${file.lastModified}-${index}`;
                     // Log bên trong map, trước khi return JSX
                     console.log('Mapping video file:', file.name, 'with key:', uniqueKey);
                     return ( // <-- Return phần tử JSX
                       <li key={uniqueKey} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300 py-1 border-b dark:border-gray-600 last:border-b-0">
                         <span>{file.name}</span>
                         <button
                           type="button"
                           onClick={() => removeVideo(index)}
                           className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900"
                           disabled={isLoading}
                           title="Xóa video này"
                         >
                           <FiX size={14} />
                         </button>
                       </li>
                     );
                   })} {/* <-- Kết thúc thân hàm explicit */}
                 </ul>
               </div>
             )}
             {/* Kết thúc phần hiển thị danh sách */}
           </div>


          {/* --- SRT Input --- */}
          <div>
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
              disabled={isLoading}
            />
            {srtFile && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Đã chọn: {srtFile.name}</p>
            )}
          </div>

          {/* --- Submit & Clear Buttons --- */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
             <button
               type="submit"
               disabled={isLoading || !audioFile || videoFiles.length === 0 || !srtFile}
               className="w-full sm:w-auto flex-grow px-6 py-3 text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center justify-center"
             >
               {isLoading ? (
                 <> <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Đang xử lý... </>
               ) : ( 'Bắt đầu Tạo Video' )}
             </button>
             <button
               type="button"
               onClick={clearInputs}
               disabled={isLoading}
               className="w-full sm:w-auto px-6 py-3 text-sm text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
             >
                Xóa lựa chọn
             </button>
          </div>

          {/* --- Status/Error Messages --- */}
          <div className="mt-6 space-y-3">
              {statusMessage && !error && (
                  <div className="p-3 text-sm text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-md flex items-center justify-center">
                      <FiCheckCircle className="mr-2 text-green-500" size={18}/>
                      <span>{statusMessage}</span>
                  </div>
              )}
              {error && (
                <div className="p-3 text-sm text-center text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md flex items-center justify-center">
                  <FiAlertCircle className="mr-2" size={18}/>
                  <span>Lỗi: {error}</span>
                </div>
              )}
              {(isLoading || statusMessage.includes('xử lý')) && !error && (
                 <div className="mt-4 p-3 text-xs text-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    Quá trình xử lý video diễn ra ngầm và có thể mất vài phút (hoặc lâu hơn tùy thuộc vào độ dài và số lượng file).
                    Bạn có thể kiểm tra các file kết quả tại đây (cần làm mới trang sau một lúc): {' '}
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