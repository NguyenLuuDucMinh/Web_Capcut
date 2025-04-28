// app/page.tsx
import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';

export default function RootPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] text-center">
       <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
         Chào mừng đến với Podcast Video Generator
       </h1>
       <p className="text-lg text-text-secondary mb-8 max-w-xl">
         Công cụ giúp bạn dễ dàng biến podcast, các video clip ngắn và phụ đề thành một video hoàn chỉnh.
       </p>
       <Link
         href="/Upload"
         className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-lg shadow-lg hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105"
       >
         Bắt đầu tạo Video
         <FiArrowRight className="ml-2" />
       </Link>
    </div>
  );
}