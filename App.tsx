
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { VideoControls } from './components/VideoControls';
import { PreviewCanvas } from './components/PreviewCanvas';
import { InfoIcon } from './components/Icons';
import { Header } from './components/Header';
import AIVideoGenPage from './pages/AIVideoGenPage';
import CombineClipsPage from './pages/CombineClipsPage';
import type { VideoTransform, ChromaKeySettings, RGBColor, PageKey } from './types';

interface LayerDimensions {
  width: number;
  height: number;
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('bk-ground-swap');

  const [bottomLayerFile, setBottomLayerFile] = useState<File | null>(null);
  const [topLayerFile, setTopLayerFile] = useState<File | null>(null);

  const [bottomLayerUrl, setBottomLayerUrl] = useState<string | null>(null);
  const [topLayerUrl, setTopLayerUrl] = useState<string | null>(null);

  const [bottomLayerType, setBottomLayerType] = useState<'image' | 'video' | null>(null);
  const [topLayerType, setTopLayerType] = useState<'image' | 'video' | null>(null);
  
  const [bottomLayerDimensions, setBottomLayerDimensions] = useState<LayerDimensions | null>(null);
  const [topLayerAspectRatio, setTopLayerAspectRatio] = useState<number | null>(null);
  
  const [videoTransform, setVideoTransform] = useState<VideoTransform>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    size: 100,
  });

  const [chromaKeySettings, setChromaKeySettings] = useState<ChromaKeySettings>({
    color: { r: 0, g: 255, b: 0 },
    hexColor: '#00FF00',
    tolerance: 50,
  });

  const [isRecording, setIsRecording] = useState(false);
  
  const bottomVideoRef = useRef<HTMLVideoElement>(null);
  const bottomImageRef = useRef<HTMLImageElement>(null);
  const topVideoRef = useRef<HTMLVideoElement>(null);
  const topImageRef = useRef<HTMLImageElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const bottomLayerUrlRef = useRef<string | null>(null);
  const topLayerUrlRef = useRef<string |null>(null);

  const handleFileUpload = (file: File, layer: 'bottom' | 'top') => {
    const fileType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : null);
    if (!fileType) {
        alert("Unsupported file type. Please upload an image or video.");
        return;
    }

    const newUrl = URL.createObjectURL(file);

    if (layer === 'bottom') {
        if (bottomLayerUrlRef.current) URL.revokeObjectURL(bottomLayerUrlRef.current);
        bottomLayerUrlRef.current = newUrl;
        setBottomLayerFile(file);
        setBottomLayerUrl(newUrl);
        setBottomLayerType(fileType);
        setBottomLayerDimensions(null);
    } else { // Top layer
        if (topLayerUrlRef.current) URL.revokeObjectURL(topLayerUrlRef.current);
        topLayerUrlRef.current = newUrl;
        setTopLayerFile(file);
        setTopLayerUrl(newUrl);
        setTopLayerType(fileType);
        setTopLayerAspectRatio(null);
    }
  };
  
  // Effect for unmount cleanup of any remaining Object URLs
  useEffect(() => {
    return () => {
      if (bottomLayerUrlRef.current) {
        URL.revokeObjectURL(bottomLayerUrlRef.current);
        bottomLayerUrlRef.current = null;
      }
      if (topLayerUrlRef.current) {
        URL.revokeObjectURL(topLayerUrlRef.current);
        topLayerUrlRef.current = null;
      }
    };
  }, []);

  const handleBottomLayerLoad = () => {
    const element = bottomLayerType === 'video' ? bottomVideoRef.current : bottomImageRef.current;
    if (!element) return;

    if (element instanceof HTMLImageElement) {
        if (element.naturalWidth > 0 && element.naturalHeight > 0) {
            setBottomLayerDimensions({ width: element.naturalWidth, height: element.naturalHeight });
        }
    } else if (element instanceof HTMLVideoElement) {
        if (element.videoWidth > 0 && element.videoHeight > 0) {
            setBottomLayerDimensions({ width: element.videoWidth, height: element.videoHeight });
            element.play().catch(e => console.warn("Bottom layer video auto-play failed:", e));
        }
    }
  };

  const handleTopLayerLoad = () => {
    const element = topLayerType === 'video' ? topVideoRef.current : topImageRef.current;
    if (!element) return;

    let aspectRatio: number | null = null;

    if (element instanceof HTMLImageElement) {
        if (element.naturalWidth > 0 && element.naturalHeight > 0) {
            aspectRatio = element.naturalWidth / element.naturalHeight;
        }
    } else if (element instanceof HTMLVideoElement) {
        if (element.videoWidth > 0 && element.videoHeight > 0) {
            aspectRatio = element.videoWidth / element.videoHeight;
            element.play().catch(e => console.warn("Top layer video auto-play failed:", e));
        }
    }

    if (aspectRatio) {
        setTopLayerAspectRatio(aspectRatio);
    }
  };

  // Effect to reset transform when a new top layer is loaded (aspect ratio changes) and the bottom layer is present.
  useEffect(() => {
    if (topLayerAspectRatio && bottomLayerDimensions) {
        // Define 100% size as 50% of the canvas width
        const widthAt100Percent = bottomLayerDimensions.width * 0.5;
        
        const newWidth = widthAt100Percent; // Since we are setting size to 100
        const newHeight = newWidth / topLayerAspectRatio;

        setVideoTransform({
            size: 100,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
            x: Math.round((bottomLayerDimensions.width - newWidth) / 2),
            y: Math.round((bottomLayerDimensions.height - newHeight) / 2),
        });
    }
  }, [topLayerAspectRatio, bottomLayerDimensions]);

  const handleTransformChange = useCallback((newPartialTransform: Partial<VideoTransform>) => {
    if (!topLayerAspectRatio || !bottomLayerDimensions) return;

    setVideoTransform(prev => {
        const updatedTransform = { ...prev, ...newPartialTransform };

        if (newPartialTransform.size !== undefined) {
            // Define 100% size as 50% of the container width
            const baseWidth = bottomLayerDimensions.width * 0.5;
            const newWidth = baseWidth * (newPartialTransform.size / 100);
            updatedTransform.width = Math.round(newWidth);
            updatedTransform.height = Math.round(newWidth / topLayerAspectRatio);
        }
        return updatedTransform;
    });
  }, [topLayerAspectRatio, bottomLayerDimensions]);

  const hexToRgb = (hex: string): RGBColor | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  };
  
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  };

  const handleChromaKeyChange = (newSettings: Partial<ChromaKeySettings>) => {
    setChromaKeySettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.hexColor) {
        updated.color = hexToRgb(newSettings.hexColor) || prev.color;
      } else if (newSettings.color) { 
        updated.hexColor = rgbToHex(newSettings.color.r, newSettings.color.g, newSettings.color.b);
      }
      return updated;
    });
  };

  const getSupportedMimeType = (): { mimeType: string; extension: 'webm' | 'mp4' } => {
      // Safari on iOS and desktop requires MP4. Other browsers like Chrome work more
      // reliably with WebM/Opus for MediaRecorder with AudioContext.
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      const webmPrioritizedTypes = [
          { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
          { mimeType: 'video/webm;codecs=vp8,vorbis', extension: 'webm' },
          { mimeType: 'video/webm', extension: 'webm' },
          { mimeType: 'video/mp4', extension: 'mp4' }, // Fallback for browsers that support MP4 but not WebM
      ] as const;
      
      const mp4PrioritizedTypes = [
          { mimeType: 'video/mp4', extension: 'mp4' },
          { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
      ] as const;

      const typesToCheck = isSafari ? mp4PrioritizedTypes : webmPrioritizedTypes;

      for (const type of typesToCheck) {
          if (MediaRecorder.isTypeSupported(type.mimeType)) {
              return type;
          }
      }
      // Fallback if none are supported (very unlikely)
      return { mimeType: '', extension: 'webm' };
  };

  const handleStartRecording = () => {
    if (!canvasRef.current) return;

    // 1. Set up Audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const audioDestination = audioContext.createMediaStreamDestination();
    let hasAudio = false;

    const videoElements = [bottomVideoRef.current, topVideoRef.current].filter(Boolean) as HTMLVideoElement[];
    
    // Unmute video elements to allow audio capture. The audio is routed to the
    // recorder, not speakers, so it won't be audible to the user.
    videoElements.forEach(v => { v.muted = false; });
    
    videoElements.forEach(videoEl => {
        // A video element's audio can be captured if it has a readyState > 0
        // and is not muted.
        if (videoEl.readyState > 0) {
            try {
                const source = audioContext.createMediaElementSource(videoEl);
                source.connect(audioDestination);
                hasAudio = true;
            } catch (e) {
                console.warn(`Could not process audio for video ${videoEl.src}:`, e);
            }
        }
    });

    // 2. Set up Video
    const canvasStream = canvasRef.current.captureStream(30); 
    const videoTrack = canvasStream.getVideoTracks()[0];

    // 3. Combine Streams
    const finalStream = new MediaStream([videoTrack]);
    if (hasAudio) {
        audioDestination.stream.getAudioTracks().forEach(track => finalStream.addTrack(track));
    }
    
    // 4. Set up MediaRecorder
    const supportedType = getSupportedMimeType();
    if (!supportedType.mimeType) {
        alert("Sorry, your browser doesn't support video recording.");
        videoElements.forEach(v => { v.muted = true; });
        return;
    }

    const options = { mimeType: supportedType.mimeType };
    mediaRecorderRef.current = new MediaRecorder(finalStream, options);
    
    recordedChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: options.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `videyo_export.${supportedType.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Re-mute videos after recording is finished.
      videoElements.forEach(v => { v.muted = true; });

      audioContext.close(); // Clean up audio context
    };

    // 5. Start Recording
    // Sync videos to the beginning before recording
    videoElements.forEach(v => {
        v.loop = true; // Explicitly set loop to true to prevent it from stopping.
        v.currentTime = 0;
        v.play().catch(e => console.warn("Could not restart video for recording", e));
    });

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const isPreviewReady = bottomLayerUrl && topLayerUrl && topLayerAspectRatio && bottomLayerDimensions && bottomLayerDimensions.width > 0;
  
  const bottomLayerElement = bottomLayerType === 'video' ? bottomVideoRef.current : bottomImageRef.current;
  const topLayerElement = topLayerType === 'video' ? topVideoRef.current : topImageRef.current;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 to-indigo-900">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <main className="flex-grow flex flex-col items-center p-4 md:p-8 w-full">
        {currentPage === 'bk-ground-swap' && (
          <div className="w-full flex flex-col items-center">
            <header className="mb-8 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Video Background Remover
              </h1>
              <p className="text-gray-300 mt-2 text-sm md:text-base">
                Upload a bottom layer, a top layer with a solid color backdrop, and watch the magic happen!
              </p>
            </header>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6 bg-gray-800 p-6 rounded-xl shadow-2xl">
                <div>
                  <h2 className="text-xl font-semibold mb-3 text-indigo-400">1. Upload Layers</h2>
                  <FileUploader
                    label="Bottom Layer (Image/Video)"
                    onFileUpload={(file) => handleFileUpload(file, 'bottom')}
                    accept="image/*,video/*"
                  />
                   {bottomLayerUrl && <div className="mt-2 rounded max-h-32 flex justify-center bg-black/20">{bottomLayerType === 'image' ? <img src={bottomLayerUrl} alt="Bottom layer preview" className="object-contain" /> : <video src={bottomLayerUrl} muted className="object-contain" />}</div>}
                </div>
                <div>
                  <FileUploader
                    label="Top Layer (with solid background)"
                    onFileUpload={(file) => handleFileUpload(file, 'top')}
                    accept="image/*,video/*"
                  />
                  {topLayerUrl && <div className="mt-2 rounded max-h-32 flex justify-center bg-black/20">{topLayerType === 'image' ? <img src={topLayerUrl} alt="Top layer preview" className="object-contain" /> : <video src={topLayerUrl} muted className="object-contain" />}</div>}
                </div>
                
                <div className="hidden">
                    {bottomLayerUrl && bottomLayerType === 'video' && <video ref={bottomVideoRef} src={bottomLayerUrl} onLoadedMetadata={handleBottomLayerLoad} loop muted playsInline />}
                    {bottomLayerUrl && bottomLayerType === 'image' && <img ref={bottomImageRef} src={bottomLayerUrl} onLoad={handleBottomLayerLoad} alt="Bottom layer source" />}
                    {topLayerUrl && topLayerType === 'video' && <video ref={topVideoRef} src={topLayerUrl} onLoadedMetadata={handleTopLayerLoad} loop muted playsInline />}
                    {topLayerUrl && topLayerType === 'image' && <img ref={topImageRef} src={topLayerUrl} onLoad={handleTopLayerLoad} alt="Top layer source" />}
                </div>

                <VideoControls
                  transform={videoTransform}
                  onTransformChange={handleTransformChange}
                  topLayerAspectRatio={topLayerAspectRatio}
                  bottomLayerDimensions={bottomLayerDimensions}
                  chromaKeySettings={chromaKeySettings}
                  onChromaKeyChange={handleChromaKeyChange}
                  isRecording={isRecording}
                  onStartRecording={handleStartRecording}
                  onStopRecording={handleStopRecording}
                />
              </div>

              <div className="lg:col-span-2 bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-3 text-indigo-400">2. Preview & Adjust</h2>
                { isPreviewReady ? ( 
                  <PreviewCanvas
                    canvasRef={canvasRef}
                    bottomLayerElement={bottomLayerElement}
                    bottomLayerDimensions={bottomLayerDimensions}
                    topLayerElement={topLayerElement}
                    videoTransform={videoTransform}
                    chromaKeySettings={chromaKeySettings}
                    onTransformChange={handleTransformChange}
                    isRecording={isRecording}
                  />
                ) : (
                  <div className="w-full aspect-[16/9] bg-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-400">
                    <InfoIcon className="w-12 h-12 mb-4 text-indigo-400"/>
                    <p>Upload a bottom and top layer to see the preview.</p>
                     {!bottomLayerUrl && <p className="text-xs mt-1">Bottom layer missing.</p>}
                     {bottomLayerUrl && !bottomLayerDimensions && <p className="text-xs mt-1">Loading bottom layer or failed to load. Check console.</p>}
                     {!topLayerUrl && <p className="text-xs mt-1">Top layer missing.</p>}
                     {topLayerUrl && !topLayerAspectRatio && <p className="text-xs mt-1">Loading top layer or failed to load. Check console.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {currentPage === 'ai-video-gen' && <AIVideoGenPage />}
        {currentPage === 'combine-clips' && <CombineClipsPage />}
      </main>
      
      <footer className="w-full text-center text-gray-500 text-sm py-4">
        <p>Powered by React and Tailwind CSS.</p>
      </footer>
    </div>
  );
};

export default App;
