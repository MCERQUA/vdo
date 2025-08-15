
import React, { useState, useEffect } from 'react';
import type { VideoTransform, ChromaKeySettings } from '../types';
import { RecordIcon, StopIcon, LockClosedIcon } from './Icons';

interface LayerDimensions {
  width: number;
  height: number;
}

interface VideoControlsProps {
  transform: VideoTransform; 
  onTransformChange: (transform: Partial<VideoTransform>) => void; 
  topLayerAspectRatio: number | null;
  bottomLayerDimensions: LayerDimensions | null; 
  chromaKeySettings: ChromaKeySettings;
  onChromaKeyChange: (settings: Partial<ChromaKeySettings>) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

type PercentageInputKeys = 'lr_pos_percent' | 'ud_pos_percent';

export const VideoControls: React.FC<VideoControlsProps> = ({
  transform,
  onTransformChange,
  topLayerAspectRatio,
  bottomLayerDimensions,
  chromaKeySettings,
  onChromaKeyChange,
  isRecording,
  onStartRecording,
  onStopRecording,
}) => {
  const [percentValues, setPercentValues] = useState<Record<PercentageInputKeys, string>>({
    lr_pos_percent: 'N/A',
    ud_pos_percent: 'N/A',
  });
  const [isInputFocused, setIsInputFocused] = useState(false);

  const controlsEnabled = !!bottomLayerDimensions && !!topLayerAspectRatio;

  useEffect(() => {
    if (!controlsEnabled) {
      setPercentValues({
        lr_pos_percent: 'N/A',
        ud_pos_percent: 'N/A',
      });
      return;
    }

    if (isInputFocused) {
        return;
    }

    const bottomWidth = bottomLayerDimensions!.width;
    const bottomHeight = bottomLayerDimensions!.height;
    const topLayerWidthPx = transform.width;
    const topLayerHeightPx = transform.height;

    let lrPercent, udPercent;
    const movableWidth = bottomWidth - topLayerWidthPx;
    lrPercent = movableWidth <= 0 ? 50 : (transform.x / movableWidth) * 100;

    const movableHeight = bottomHeight - topLayerHeightPx;
    udPercent = movableHeight <= 0 ? 50 : (transform.y / movableHeight) * 100;
    
    lrPercent = Math.max(0, Math.min(100, lrPercent));
    udPercent = Math.max(0, Math.min(100, udPercent));

    setPercentValues({
      lr_pos_percent: lrPercent.toFixed(1),
      ud_pos_percent: udPercent.toFixed(1),
    });

  }, [transform, bottomLayerDimensions, controlsEnabled, isInputFocused]);


  const handlePercentageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!bottomLayerDimensions || !topLayerAspectRatio) return;

    const { name, value } = e.target as { name: PercentageInputKeys, value: string };
    
    setPercentValues(prev => ({ ...prev, [name]: value }));

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return; 

    const bottomWidth = bottomLayerDimensions.width;
    const bottomHeight = bottomLayerDimensions.height;

    let newPixelTransform: Partial<VideoTransform> = {};

    switch (name) {
      case 'lr_pos_percent': {
        const movableWidth = bottomWidth - transform.width;
        newPixelTransform.x = movableWidth <= 0 ? movableWidth / 2 : Math.round((numValue / 100) * movableWidth);
        break;
      }
      case 'ud_pos_percent': {
        const movableHeight = bottomHeight - transform.height;
        newPixelTransform.y = movableHeight <= 0 ? movableHeight / 2 : Math.round((numValue / 100) * movableHeight);
        break;
      }
      default:
        return;
    }
    onTransformChange(newPixelTransform);
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTransformChange({ size: parseInt(e.target.value, 10) });
  };
  
  const handleChromaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'hexColor') {
      onChromaKeyChange({ hexColor: e.target.value });
    } else if (e.target.name === 'tolerance') {
      onChromaKeyChange({ tolerance: parseInt(e.target.value, 10) });
    }
  };

  const handleFocus = () => setIsInputFocused(true);
  const handleBlur = () => setIsInputFocused(false);

  const transformFields: { key: PercentageInputKeys; label: string; }[] = [
    { key: 'lr_pos_percent', label: 'Left/Right Position (%)' },
    { key: 'ud_pos_percent', label: 'Up/Down Position (%)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3 text-indigo-400">Chroma Key Settings (Top Layer)</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="hexColor" className="block text-sm font-medium text-gray-300">Key Color (HEX)</label>
            <div className="flex items-center space-x-2 mt-1">
              <input
                type="color"
                id="nativeColorPicker"
                aria-label="Chroma key color picker"
                value={chromaKeySettings.hexColor}
                onChange={(e) => onChromaKeyChange({ hexColor: e.target.value })}
                className="p-0 w-8 h-8 border-none rounded cursor-pointer bg-gray-700 hover:ring-2 hover:ring-indigo-500"
              />
              <input
                type="text"
                name="hexColor"
                id="hexColor"
                aria-label="Chroma key color HEX input"
                value={chromaKeySettings.hexColor}
                onChange={handleChromaInputChange}
                className="block w-full shadow-sm sm:text-sm border-gray-600 rounded-md bg-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
                placeholder="#00FF00"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="tolerance" className="block text-sm font-medium text-gray-300">Tolerance: {chromaKeySettings.tolerance}</label>
            <input
              type="range"
              name="tolerance"
              id="tolerance"
              min="0"
              max="255"
              value={chromaKeySettings.tolerance}
              onChange={handleChromaInputChange}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-1 accent-indigo-500"
              aria-label={`Chroma key tolerance: ${chromaKeySettings.tolerance}`}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-indigo-400">Top Layer Transform</h3>
            {topLayerAspectRatio && <LockClosedIcon className="w-5 h-5 text-indigo-400" titleAccessText="Aspect ratio locked" />}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {transformFields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-sm font-medium text-gray-300">{field.label}</label>
                <input
                  type="number"
                  name={field.key}
                  id={field.key}
                  aria-label={`Top layer transform ${field.label}`}
                  value={percentValues[field.key] === 'N/A' ? '' : percentValues[field.key]}
                  onChange={handlePercentageInputChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-600 rounded-md bg-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  step="0.1" 
                  min="0" 
                  disabled={!controlsEnabled}
                  placeholder={percentValues[field.key] === 'N/A' ? 'N/A' : ''}
                />
              </div>
            ))}
          </div>

          <div>
              <label htmlFor="size" className="block text-sm font-medium text-gray-300">Size: {transform.size}%</label>
              <input
                type="range"
                name="size"
                id="size"
                min="0"
                max="200"
                value={transform.size}
                onChange={handleSizeChange}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-1 accent-indigo-500"
                disabled={!controlsEnabled}
                aria-label={`Top layer size: ${transform.size}%`}
              />
          </div>
        </div>

         {!controlsEnabled && topLayerAspectRatio && <p className="text-xs text-gray-400 mt-2">Upload a bottom layer to enable transform controls.</p>}
         {!topLayerAspectRatio && <p className="text-xs text-gray-400 mt-2">Upload a top layer to enable transform controls.</p>}
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-2 text-indigo-400">Recording</h3>
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            disabled={!controlsEnabled}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            aria-label="Start recording video"
          >
            <RecordIcon className="w-5 h-5 mr-2"/>
            Start Recording
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors duration-150"
            aria-label="Stop recording and download video"
          >
            <StopIcon className="w-5 h-5 mr-2"/>
            Stop Recording & Download
          </button>
        )}
      </div>
    </div>
  );
};