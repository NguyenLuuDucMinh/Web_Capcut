'use client';

// 1. Import với tên viết hoa (PascalCase) và đúng tên file
import UploadForm from './uploadForm';

export default function UploadPage() {
  return (
    <div className="flex flex-col items-center justify-start pt-10">
      <div className="w-full max-w-3xl bg-tech-card rounded-lg shadow-xl p-6 md:p-10 border border-tech-primary/50">
        <h1 className="text-3xl md:text-4xl font-bold text-tech-accent mb-4 text-center">
          Podcast Video Generator
        </h1>
        <p className="text-tech-text-secondary mb-8 text-center">
          Upload your podcast audio, short video clips, and subtitle file (SRT) to create a dynamic video.
        </p>
        {/* 2. Sử dụng component với tên viết hoa (PascalCase) */}
        <UploadForm />
      </div>
    </div>
  );
}