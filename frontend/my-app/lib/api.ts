// Define the expected structure of the API response from the Python backend
export interface ApiResponse {
  success: boolean;       // Indicates if the overall operation was successful
  message: string;        // A message describing the result or error
  url?: string;           // Optional: URL of the generated video if immediately available
  jobId?: string;         // Optional: An ID if the processing is asynchronous
}

/**
* Uploads audio, video clips, and SRT file to the backend API.
*
* @param audioFile The podcast audio file.
* @param videoFiles An array of short video clip files.
* @param srtFile The subtitle file (.srt).
* @returns A Promise resolving to an ApiResponse object.
*/
export const uploadFiles = async (
  audioFile: File,
  videoFiles: File[],
  srtFile: File
): Promise<ApiResponse> => {
  // Get the backend API endpoint from environment variables or use a default
  // Create a .env.local file in your project root with:
  // NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api/generate-video (or your actual backend URL)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api/generate-video'; // Fallback

  const formData = new FormData();

  // Append the files with specific keys that the backend expects
  formData.append('audio', audioFile, audioFile.name);
  formData.append('srt', srtFile, srtFile.name);

  // Append each video file. The backend needs to be configured
  // to handle multiple files associated with the same key ('videos').
  videoFiles.forEach((video) => {
      formData.append('videos', video, video.name);
  });

  try {
      console.log("Sending request to:", backendUrl);
      // Log FormData contents for debugging (optional)
      // for (let [key, value] of formData.entries()) {
      //     console.log(`${key}:`, value);
      // }

      const response = await fetch(backendUrl, {
          method: 'POST',
          body: formData,
          // Fetch automatically sets 'Content-Type': 'multipart/form-data' with boundary
          // when the body is FormData. No need to set it manually.
          // Add other headers if needed (e.g., Authorization)
          // headers: {
          //   'Authorization': 'Bearer YOUR_TOKEN',
          // },
      });

      // Try to parse the response body regardless of status code, as backend might send error details in JSON
      let responseData: any;
      try {
          responseData = await response.json();
      } catch (jsonError) {
          // If JSON parsing fails (e.g., empty body or non-JSON response)
          console.error("Failed to parse response JSON:", jsonError);
          // If the status code indicated failure, create a generic error message
          if (!response.ok) {
              return {
                  success: false,
                  message: `Server error: ${response.status} ${response.statusText}. Response was not valid JSON.`,
              };
          }
          // If status was OK but JSON failed, maybe it's an unexpected success response format
          console.warn("Received OK status but failed to parse JSON response.");
          // You might return success: true here, or handle it as an error depending on expectations
           return { success: true, message: "Operation likely succeeded, but response format was unexpected." };
          // OR return { success: false, message: "Received OK status, but couldn't read response details." };
      }

      // Handle non-OK HTTP status codes (4xx, 5xx) using the parsed JSON data if available
      if (!response.ok) {
          console.error("API Error Response:", responseData);
          // Use a specific error message from the backend if available, otherwise use status text
          const errorMessage = responseData?.message || responseData?.detail || `Request failed with status ${response.status}`;
          return {
              success: false,
              message: errorMessage,
          };
      }

      // If response is OK (2xx) and JSON parsing succeeded, return the data
      // Assume the backend response matches the ApiResponse interface on success
      return {
          success: responseData.success !== undefined ? responseData.success : true, // Assume success if key missing but status OK
          message: responseData.message || 'Operation successful.',
          url: responseData.url,
          jobId: responseData.jobId,
      };

  } catch (error: any) {
      console.error("Network error or exception during fetch:", error);
      // Handle network errors (e.g., backend server down) or other unexpected errors
      return {
          success: false,
          message: error.message || 'Network error or unable to connect to the server.',
      };
  }
};