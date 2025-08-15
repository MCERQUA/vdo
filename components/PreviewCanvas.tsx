
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { VideoTransform, ChromaKeySettings } from '../types';

interface LayerDimensions {
  width: number;
  height: number;
}

interface PreviewCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  bottomLayerElement: HTMLImageElement | HTMLVideoElement | null;
  bottomLayerDimensions: LayerDimensions | null;
  topLayerElement: HTMLImageElement | HTMLVideoElement | null;
  videoTransform: VideoTransform;
  chromaKeySettings: ChromaKeySettings;
  onTransformChange: (transform: Partial<VideoTransform>) => void;
  isRecording: boolean;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  canvasRef,
  bottomLayerElement,
  bottomLayerDimensions,
  topLayerElement,
  videoTransform,
  chromaKeySettings,
  onTransformChange,
  isRecording,
}) => {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialTransformX: number;
    initialTransformY: number;
  } | null>(null);

  // Setup offscreen canvas
  useEffect(() => {
    offscreenCanvasRef.current = document.createElement('canvas');
  }, []);

  const getCanvasRelativePos = (canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const isPointInTopLayer = (pos: { x: number; y: number }): boolean => {
    const { x, y, width, height } = videoTransform;
    return pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height;
  };

  const handleDragStart = useCallback((pos: {x: number, y: number}) => {
    if (topLayerElement && isPointInTopLayer(pos)) {
        setIsDragging(true);
        dragStartRef.current = {
            startX: pos.x,
            startY: pos.y,
            initialTransformX: videoTransform.x,
            initialTransformY: videoTransform.y,
        };
        return true; // Drag started
    }
    return false; // Drag did not start
  }, [topLayerElement, videoTransform]);

  const handleDragMove = useCallback((pos: {x: number, y: number} | null) => {
    if (isDragging && dragStartRef.current && pos) {
      const dx = pos.x - dragStartRef.current.startX;
      const dy = pos.y - dragStartRef.current.startY;
      
      onTransformChange({
        x: Math.round(dragStartRef.current.initialTransformX + dx),
        y: Math.round(dragStartRef.current.initialTransformY + dy),
      });
    }
  }, [isDragging, onTransformChange]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  // --- Mouse Event Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasRelativePos(canvas, e.clientX, e.clientY);
    if (pos && handleDragStart(pos)) {
      e.preventDefault();
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasRelativePos(canvas, e.clientX, e.clientY);

    if (isDragging) {
        handleDragMove(pos);
    } else if (topLayerElement && pos) {
        setIsHovering(isPointInTopLayer(pos));
    } else {
        setIsHovering(false);
    }
  }, [isDragging, handleDragMove, topLayerElement, canvasRef, videoTransform]);

  // --- Touch Event Handlers ---
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const touch = e.touches[0];
    const pos = getCanvasRelativePos(canvas, touch.clientX, touch.clientY);
    if (pos && handleDragStart(pos)) {
        e.preventDefault();
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const touch = e.touches[0];
    const pos = getCanvasRelativePos(canvas, touch.clientX, touch.clientY);
    handleDragMove(pos);
  }, [handleDragMove, canvasRef]);


  // Effect for global event listeners
  useEffect(() => {
    // Mouse listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    // Touch listeners
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);

    return () => {
      // Mouse cleanup
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      // Touch cleanup
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [handleMouseMove, handleDragEnd, handleTouchMove]);


  // Animation loop for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    
    if (!canvas || !offscreenCanvas || !bottomLayerDimensions) {
      return;
    }

    // Set canvas size based on bottom layer
    if (canvas.width !== bottomLayerDimensions.width) canvas.width = bottomLayerDimensions.width;
    if (canvas.height !== bottomLayerDimensions.height) canvas.height = bottomLayerDimensions.height;

    const ctx = canvas.getContext('2d');
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || !offscreenCtx) return;
    
    let animationFrameId: number;

    const render = () => {
      // On mobile, videos can pause during recording. This ensures they keep playing.
      if (isRecording) {
        [bottomLayerElement, topLayerElement].forEach(el => {
            if (el instanceof HTMLVideoElement && el.paused) {
                el.play().catch(e => console.warn("Forced video play during recording failed:", e));
            }
        });
      }

      // Draw bottom layer
      if (bottomLayerElement) {
        ctx.drawImage(bottomLayerElement, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#374151'; // gray-700
        ctx.fillRect(0,0, canvas.width, canvas.height);
      }
      
      // Process and draw top layer
      if (topLayerElement) {
        let topWidth = 0;
        let topHeight = 0;

        if (topLayerElement instanceof HTMLImageElement) {
            topWidth = topLayerElement.naturalWidth;
            topHeight = topLayerElement.naturalHeight;
        } else if (topLayerElement instanceof HTMLVideoElement) {
            topWidth = topLayerElement.videoWidth;
            topHeight = topLayerElement.videoHeight;
        }

        if (topWidth > 0 && topHeight > 0) {
            if (offscreenCanvas.width !== topWidth) offscreenCanvas.width = topWidth;
            if (offscreenCanvas.height !== topHeight) offscreenCanvas.height = topHeight;
            
            offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            offscreenCtx.drawImage(topLayerElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

            try {
              const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
              const data = imageData.data;
              const keyColor = chromaKeySettings.color;
              const tolerance = chromaKeySettings.tolerance;

              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const distance = Math.sqrt(
                  Math.pow(r - keyColor.r, 2) +
                  Math.pow(g - keyColor.g, 2) +
                  Math.pow(b - keyColor.b, 2)
                );

                if (distance < tolerance) {
                  data[i + 3] = 0; // Set alpha to 0 (transparent)
                }
              }
              offscreenCtx.putImageData(imageData, 0, 0);

              ctx.drawImage(
                offscreenCanvas,
                videoTransform.x,
                videoTransform.y,
                videoTransform.width,
                videoTransform.height
              );

            } catch (error) {
              console.error("Error processing top layer frame (getImageData):", error);
              // Draw directly as fallback
              ctx.drawImage(
                  topLayerElement,
                  videoTransform.x,
                  videoTransform.y,
                  videoTransform.width,
                  videoTransform.height
              );
            }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [bottomLayerElement, topLayerElement, bottomLayerDimensions, canvasRef, videoTransform, chromaKeySettings, offscreenCanvasRef, isRecording]);


  return (
    <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="w-full h-auto object-contain rounded-lg border border-indigo-500 shadow-lg" 
        style={{
            maxWidth: '100%', 
            maxHeight: 'calc(100vh - 200px)',
            cursor: isDragging ? 'grabbing' : isHovering ? 'grab' : 'default',
            touchAction: 'none', // Prevents scrolling on touch devices when interacting with the canvas
        }} 
    />
  );
};
