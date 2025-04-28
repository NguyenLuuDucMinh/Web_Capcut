'use client';

import React from 'react';
import { FiLoader } from 'react-icons/fi'; // Loading spinner icon

interface UploadButtonProps {
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; // Optional click handler
  type?: 'button' | 'submit' | 'reset';
}

const UploadButton: React.FC<UploadButtonProps> = ({
  label,
  isLoading = false,
  disabled = false,
  onClick,
  type = 'submit', // Default to submit type
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-full flex items-center justify-center px-6 py-3 border border-transparent
        text-base font-medium rounded-md shadow-sm
        transition duration-150 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-tech-bg focus:ring-tech-accent
        ${isDisabled
          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
          : 'bg-tech-accent text-tech-bg hover:bg-opacity-80'
        }
        ${isLoading ? 'animate-pulse-fast' : ''}
      `}
    >
      {isLoading ? (
        <>
          <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" />
          Processing...
        </>
      ) : (
        label
      )}
    </button>
  );
};

export default UploadButton;