// src/app/upload/uploadForm/page.tsx
'use client'; // Bắt buộc vì chúng ta dùng hooks (useState, useRef) và event handlers

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
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
  // Lưu trữ thông điệp trạng thái thay vì URL kết quả trực tiếp do dùng background task
  const [statusMessage, setStatusMessage] = useState<string>('');

  // --- Refs for File Inputs ---
  // Giúp chúng ta có thể xóa giá trị của input (ví dụ: sau khi upload hoặc khi clear)
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  // --- Event Handlers ---

  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setError(null); // Xóa lỗi khi chọn file mới
      setStatusMessage(''); // Xóa thông báo trạng thái cũ
    }
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Thêm các file mới chọn vào danh sách hiện có
      setVideoFiles((prevFiles) => [...prevFiles, ...Array.from(e.target.files as FileList)]);
      setError(null);
      setStatusMessage('');
      // Xóa giá trị của input để cho phép chọn lại cùng file hoặc chọn thêm file khác
      if (e.target) e.target.value = '';
    }
  };

  const handleSrtChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSrtFile(e.target.files[0]);
      setError(null);
      setStatusMessage('');
    }
  };

  // Xóa một video khỏi danh sách
  const removeVideo = (index: number) => {
    setVideoFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // Xóa tất cả các lựa chọn và trạng thái
  const clearInputs = () => {
      setAudioFile(null);
      setVideoFiles([]);
      setSrtFile(null);
      setError(null);
      setStatusMessage('');
      // Reset giá trị của các input element
      if (audioInputRef.current) audioInputRef.current.value = '';
      // Không cần reset videoInputRef vì nó đã được reset trong handleVideoChange
      if (srtInputRef.current) srtInputRef.current.value = '';
  }

  // Xử lý khi submit form
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Ngăn form submit theo cách truyền thống
    setError(null);
    setStatusMessage('');

    // Kiểm tra file cơ bản
    if (!audioFile || videoFiles.length === 0 || !srtFile) {
      setError('Vui lòng chọn đủ file Audio, ít nhất 1 Video, và file SRT.');
      return;
    }

    setIsLoading(true); // Bắt đầu trạng thái loading

    // Tạo đối tượng FormData để gửi file
    const formData = new FormData();
    formData.append('audio', audioFile);
    videoFiles.forEach((video, index) => {
      // Quan trọng: Backend FastAPI nhận danh sách file với cùng một key ('videos')
      formData.append('videos', video);
    });
    formData.append('srt', srtFile);

    try {
      setStatusMessage('Đang tải file lên và bắt đầu xử lý...');

      // Gửi request POST đến backend API
      const response = await axios.post(`${BACKEND_URL}/api/generate`, formData, {
        headers: {
          // Browser tự động set Content-Type là multipart/form-data khi gửi FormData
          // 'Content-Type': 'multipart/form-data', // Không cần thiết phải set thủ công
        },
        // Có thể thêm timeout nếu cần
        // timeout: 300000, // 5 phút
      });

      // Xử lý phản hồi từ backend (đã dùng BackgroundTasks)
      if (response.status === 202) { // 202 Accepted - Yêu cầu đã được chấp nhận xử lý ngầm
          setStatusMessage(`${response.data.message || 'Yêu cầu đã được gửi đi xử lý.'} ${response.data.detail || ''}`);
          // Không xóa input ngay để người dùng có thể thấy lựa chọn của họ
          // clearInputs(); // Có thể thêm nút "Tạo video mới" để gọi hàm này
      } else {
           // Xử lý các trường hợp thành công khác (nếu có) hoặc phản hồi không mong muốn
           setError(`Trạng thái phản hồi không mong muốn: ${response.status}`);
           setStatusMessage('');
      }

    } catch (err: any) {
      console.error('Lỗi khi upload hoặc xử lý file:', err);
      // Hiển thị lỗi chi tiết hơn từ backend nếu có
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.detail || err.message || 'Có lỗi xảy ra trong quá trình upload hoặc xử lý.'
        );
      } else {
        setError('Một lỗi không xác định đã xảy ra.');
      }
       setStatusMessage(''); // Xóa thông báo trạng thái khi có lỗi
    } finally {
      setIsLoading(false); // Kết thúc trạng thái loading
    }
  };

  // --- JSX Rendering ---
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 md:p-12 bg-gray-50 dark:bg-gray-900">
       {/* Nút quay lại trang chủ (tùy chọn) */}
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
              accept="audio/*" // Chấp nhận mọi loại audio
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
               ref={videoInputRef} // Ref này chỉ dùng để xóa (nếu cần), việc xóa được thực hiện trong onChange
               type="file"
               accept="video/*" // Chấp nhận mọi loại video
               multiple // Cho phép chọn nhiều file cùng lúc
               onChange={handleVideoChange}
               // Không cần 'required' vì kiểm tra videoFiles.length trong handleSubmit
               className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 dark:file:bg-green-900 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-100 dark:hover:file:bg-green-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
               disabled={isLoading}
             />
             {/* Hiển thị danh sách video đã chọn */}
             {videoFiles.length > 0 && (
               <div className="mt-3 space-y-2">
                 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Video đã chọn ({videoFiles.length}):</p>
                 <ul className="list-none p-2 border dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                   {videoFiles.map((file, index) => (
                     <li key={index} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300 py-1 border-b dark:border-gray-600 last:border-b-0">
                       <span>{file.name}</span>
                       <button
                         type="button" // Quan trọng: không phải type="submit"
                         onClick={() => removeVideo(index)}
                         className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900"
                         disabled={isLoading}
                         title="Xóa video này"
                       >
                         <FiX size={14} />
                       </button>
                     </li>
                   ))}
                 </ul>
               </div>
             )}
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
              accept=".srt" // Chỉ chấp nhận file .srt
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
             {/* Submit Button */}
             <button
               type="submit"
               disabled={isLoading || !audioFile || videoFiles.length === 0 || !srtFile}
               className="w-full sm:w-auto flex-grow px-6 py-3 text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center justify-center"
             >
               {isLoading ? (
                 <>
                   <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                   Đang xử lý...
                 </>
               ) : (
                 'Bắt đầu Tạo Video'
               )}
             </button>

             {/* Clear Button */}
             <button
               type="button" // Quan trọng: không phải submit
               onClick={clearInputs}
               disabled={isLoading}
               className="w-full sm:w-auto px-6 py-3 text-sm text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
             >
                Xóa lựa chọn
             </button>
          </div>


          {/* --- Status/Error Messages --- */}
          <div className="mt-6 space-y-3">
              {/* Success/Status Message */}
              {statusMessage && !error && (
                  <div className="p-3 text-sm text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-md flex items-center justify-center">
                      <FiCheckCircle className="mr-2 text-green-500" size={18}/> {/* Hoặc dùng FiInfo */}
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
               {/* Info about background processing and checking results */}
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