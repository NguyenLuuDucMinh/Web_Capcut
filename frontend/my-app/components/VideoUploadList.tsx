'use client';

import React, { useRef, ChangeEvent } from 'react';
import { FiPlus, FiTrash2, FiVideo } from 'react-icons/fi'; // Import icons

interface VideoUploadListProps {
  videos: File[]; // Array of selected video files from parent state
  onAddVideo: (file: File) => void; // Callback to add a video file
  onRemoveVideo: (index: number) => void; // Callback to remove a video by index
}

const VideoUploadList: React.FC<VideoUploadListProps> = ({ videos, onAddVideo, onRemoveVideo }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAddVideo(file); // Pass the new file to the parent
      // Reset input value to allow selecting the same file again if needed
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleAddClick = () => {
    inputRef.current?.click(); // Trigger the hidden file input
  };

  const handleRemoveClick = (index: number) => {
    onRemoveVideo(index); // Notify parent to remove the video at this index
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-tech-text-secondary mb-2">
        Short Video Clips (will loop in order)
      </label>

      {/* List of Added Videos */}
      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-2"> {/* Added scroll */}
        {videos.length === 0 && (
          <p className="text-sm text-tech-text-secondary italic px-3 py-2 bg-tech-primary/30 rounded-md">
            No video clips added yet. Click below to add.
          </p>
        )}
        {videos.map((video, index) => (
          <div
            key={index} // Using index is okay here if list order doesn't change drastically
            className="flex items-center justify-between p-2 bg-tech-primary/50 rounded-md border border-tech-primary/70"
          >
            <div className="flex items-center overflow-hidden mr-2 flex-1 min-w-0"> {/* Ensure text truncates */}
              <FiVideo className="w-4 h-4 mr-2 flex-shrink-0 text-tech-accent" />
              <span className="text-sm text-tech-text truncate" title={video.name}>
                {index + 1}. {video.name}
              </span>
            </div>
            <button
              onClick={() => handleRemoveClick(index)}
              type="button" // Important: prevent form submission
              className="p-1 text-tech-text-secondary hover:text-tech-error transition-colors rounded-full hover:bg-tech-error/20 flex-shrink-0"
              aria-label={`Remove ${video.name}`}
              title="Remove video"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="video/mp4,video/webm,video/mov,video/quicktime" // Adjust accepted video formats as needed
        onChange={handleFileChange}
      />

      {/* Add Video Button */}
      <button
        type="button" // Prevent form submission
        onClick={handleAddClick}
        className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-tech-primary hover:border-tech-accent text-tech-accent hover:bg-tech-primary/50 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-tech-bg focus:ring-tech-accent"
      >
        <FiPlus className="w-5 h-5 mr-2" />
        Add Short Video Clip
      </button>
    </div>
  );
};

export default VideoUploadList;