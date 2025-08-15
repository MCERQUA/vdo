import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MagicWandIcon, LoadingSpinner, EyeIcon, EyeOffIcon } from '../components/Icons';

const AIVideoGenPage: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'polling' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [operation, setOperation] = useState<any | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('user_gemini_api_key', newKey);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Gemini API Key to generate a video.');
      setStatus('error');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate a video.');
      setStatus('error');
      return;
    }

    setStatus('generating');
    setError(null);
    setGeneratedVideoUrl(null);
    setOperation(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const startOperation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
          aspectRatio: "16:9",
        },
      });
      setOperation(startOperation);
      setStatus('polling');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred while starting video generation.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (status !== 'polling' || !operation) return;
    
    if (!apiKey) {
        setError("API Key is missing. Polling stopped.");
        setStatus('error');
        return;
    }

    let isCancelled = false;
    const ai = new GoogleGenAI({ apiKey });

    const poll = async (op: any) => {
        if (isCancelled) return;

        try {
            const currentOperation = await ai.operations.getVideosOperation({ operation: op });

            if (isCancelled) return;

            if (currentOperation.done) {
                if (currentOperation.response?.generatedVideos?.length > 0) {
                    const videoInfo = currentOperation.response.generatedVideos[0];
                    if (videoInfo.video?.uri) {
                        const videoDataUri = `${videoInfo.video.uri}&key=${apiKey}`;
                        const response = await fetch(videoDataUri);
                        if (!response.ok) throw new Error(`Failed to fetch video file: ${response.statusText} - ${await response.text()}`);
                        const blob = await response.blob();
                        const videoUrl = URL.createObjectURL(blob);
                        setGeneratedVideoUrl(videoUrl);
                        setStatus('success');
                    } else {
                        throw new Error("Generation finished but no video URI was found.");
                    }
                } else {
                    const opError = currentOperation.error;
                    if(opError) {
                        throw new Error(`Operation failed: ${opError.message} (Code: ${opError.code})`);
                    }
                    throw new Error("The AI operation completed but did not return a video. The prompt might have been rejected for safety reasons.");
                }
            } else {
                setOperation(currentOperation);
                setTimeout(() => poll(currentOperation), 10000); // Poll again after 10s
            }
        } catch (e) {
            if (isCancelled) return;
            console.error(e);
            setError(e instanceof Error ? e.message : 'An unknown error occurred while polling for the video.');
            setStatus('error');
        }
    };

    poll(operation);

    return () => {
      isCancelled = true;
    };
  }, [status, operation, apiKey]);

  // Effect to clean up object URL
  useEffect(() => {
    return () => {
      if (generatedVideoUrl) {
        URL.revokeObjectURL(generatedVideoUrl);
      }
    };
  }, [generatedVideoUrl]);

  const isLoading = status === 'generating' || status === 'polling';

  const getStatusMessage = () => {
    switch(status) {
        case 'generating': return 'Initializing video generation...';
        case 'polling': return 'Generating video, please wait... This can take a few minutes.';
        case 'success': return 'Your video has been generated!';
        case 'error': return 'An error occurred. Please check the message below and try again.';
        case 'idle':
        default:
            return 'Describe the video you want to create. Our AI will generate it for you.';
    }
  };

  return (
    <div className="w-full max-w-4xl text-center p-8 md:p-12 bg-gray-800 rounded-xl shadow-2xl mt-8 flex flex-col items-center">
      <div className="flex justify-center mb-6">
        <MagicWandIcon className="w-16 h-16 text-indigo-400" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
        AI Video Generation
      </h1>
      <p className="text-gray-400 mb-8 min-h-[24px]">
        {getStatusMessage()}
      </p>

      <div className="w-full max-w-2xl space-y-2 mb-6">
          <label htmlFor="api-key" className="text-left block text-sm font-medium text-gray-300">
              Your Gemini API Key
          </label>
          <div className="relative">
              <input
                  id="api-key"
                  type={isKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="Enter your API key here"
                  className="w-full p-3 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  aria-label="Gemini API Key"
              />
              <button
                  type="button"
                  onClick={() => setIsKeyVisible(!isKeyVisible)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-200"
                  aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'}
              >
                  {isKeyVisible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
          </div>
          <p className="text-xs text-gray-500 text-left">
              Your key is stored in your browser's local storage. Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
          </p>
      </div>

      <div className="w-full max-w-2xl space-y-4">
        <div>
            <label htmlFor="video-prompt" className="sr-only">Video Prompt</label>
            <textarea
                id="video-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A cinematic shot of a puppy chasing a butterfly in a sunny meadow"
                className="w-full h-24 p-4 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                disabled={isLoading}
                aria-label="Video generation prompt"
            />
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim() || !apiKey.trim()}
          className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="w-5 h-5 mr-3" />
              {status === 'generating' ? 'Initializing...' : 'Generating...'}
            </>
          ) : (
            <>
              <MagicWandIcon className="w-5 h-5 mr-2" />
              Generate Video
            </>
          )}
        </button>
      </div>
      
      {status === 'error' && error && (
        <div className="mt-6 w-full max-w-2xl p-4 bg-red-900/50 text-red-300 border border-red-700 rounded-lg">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      <div className="mt-8 w-full max-w-2xl min-h-[200px]">
        {isLoading && (
            <div className="w-full aspect-video bg-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-400 animate-pulse">
                <MagicWandIcon className="w-12 h-12 mb-4"/>
                <p>Our AI is crafting your video scene...</p>
                <p className="text-sm">This may take a few minutes.</p>
            </div>
        )}
        {status === 'success' && generatedVideoUrl && (
          <div className="w-full aspect-video bg-black rounded-lg shadow-lg">
            <video 
                src={generatedVideoUrl} 
                controls 
                autoPlay 
                loop
                className="w-full h-full object-contain"
                aria-label="Generated AI video"
            >
                Your browser does not support the video tag.
            </video>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIVideoGenPage;