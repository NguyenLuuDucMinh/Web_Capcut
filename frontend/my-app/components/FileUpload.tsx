'use client';

import React, { useRef, useState, ChangeEvent, DragEvent } from 'react';
import { FiUploadCloud, FiXCircle, FiFileText, FiMusic } from 'react-icons/fi'; // Import icons

interface FileUploadProps {
  id: string;
  label: string;
  accept: string; // e.g., "audio/*", ".srt", "video/mp4"
  onFileSelect: (file: File | null) => void;
  selectedFileName: string | null; // Pass selected file name from parent
  icon?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({
  id,
  label,
  accept,
  onFileSelect,
  selectedFileName, // Use the prop
  icon
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    } else {
      // This case might happen if the user cancels the file dialog
      // We don't clear it here, parent state decides
    }
     // Important: Reset input value allows selecting the same file again
     if (inputRef.current) {
        inputRef.current.value = '';
      }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering button click
    onFileSelect(null); // Notify parent to clear the file
  };

  // Drag and Drop Handlers
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];

    // Basic check if the dropped file type is acceptable
    // This is not foolproof, backend validation is crucial
    let isTypeAcceptable = false;
    const acceptedTypes = accept.split(',').map(t => t.trim());
    if (file) {
        if (acceptedTypes.includes(file.type) || acceptedTypes.some(type => type.endsWith('/*') && file.type.startsWith(type.replace('/*', '')))) {
            isTypeAcceptable = true;
        } else if (acceptedTypes.some(type => type.startsWith('.') && file.name.endsWith(type))) {
            isTypeAcceptable = true; // Check extension for types like .srt
        }
    }


    if (file && isTypeAcceptable) {
      onFileSelect(file);
      // Optionally assign to inputRef for consistency, though not strictly needed for FormData
      // const dataTransfer = new DataTransfer();
      // dataTransfer.items.add(file);
      // if (inputRef.current) inputRef.current.files = dataTransfer.files;
    } else if (file) {
      console.warn("Dropped file type not accepted:", file.type, file.name);
      // Optionally show a user-facing error here
    }
  };

  const defaultIcon = accept.includes('audio')
    ? <FiMusic className="w-5 h-5 mr-2 text-tech-accent" />
    : <FiFileText className="w-5 h-5 mr-2 text-tech-accent" />;

  return (
    <div className="mb-6">
      <label htmlFor={id} className="block text-sm font-medium text-tech-text-secondary mb-2">
        {label}
      </label>
      <div
        onClick={handleButtonClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer
          transition-colors duration-200 ease-in-out group relative
          ${isDragging
            ? 'border-tech-accent bg-tech-primary/50'
            : 'border-tech-primary hover:border-tech-accent hover:bg-tech-primary/20'
          }
          ${selectedFileName ? '!border-solid !border-tech-success bg-tech-primary/30' : ''}
        `}
      >
        <input
          ref={inputRef}
          id={id}
          name={id} // Name might be useful for form handling without JS
          type="file"
          className="hidden" // Hide the actual input
          accept={accept}
          onChange={handleFileChange}
        />
        {selectedFileName ? (
          <div className="flex items-center justify-between w-full text-tech-text">
            <div className="flex items-center overflow-hidden whitespace-nowrap mr-2">
              {icon || defaultIcon}
              <span className="text-sm font-medium truncate">{selectedFileName}</span>
            </div>
            {/* Clear button absolutely positioned */}
            <button
              onClick={handleClear}
              type="button"
              className="absolute top-1 right-1 p-1 text-tech-text-secondary hover:text-tech-error transition-colors rounded-full hover:bg-tech-error/20 z-10"
              aria-label="Clear file"
              title="Clear selection"
            >
              <FiXCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          // Placeholder content when no file is selected
          <div className="flex flex-col items-center text-center text-tech-text-secondary group-hover:text-tech-text transition-colors">
            <FiUploadCloud className="w-8 h-8 mb-2 text-tech-accent/70 group-hover:text-tech-accent" />
            <p className="text-sm">
              <span className="font-semibold text-tech-accent">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs mt-1">Accepted: {accept}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;