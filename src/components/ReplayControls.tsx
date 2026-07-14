// src/components/ReplayControls.tsx
'use client'

import React from 'react'

interface ReplayControlsProps {
  isPlaying: boolean
  onPlayPause: () => void
  speed: number
  onChangeSpeed: (speed: number) => void
  currentTime: number
  startTime: number
  endTime: number
  onSeek: (timestamp: number) => void
}

export default function ReplayControls({
  isPlaying,
  onPlayPause,
  speed,
  onChangeSpeed,
  currentTime,
  startTime,
  endTime,
  onSeek,
}: ReplayControlsProps) {
  // Format elapsed time as MM:SS
  const elapsedMs = Math.max(0, currentTime - startTime)
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
  
  const formatTime = (min: number, sec: number) => {
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Calculate slider dimensions
  const maxVal = Math.max(1, endTime - startTime)
  const currentVal = Math.min(maxVal, Math.max(0, currentTime - startTime))

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const offsetMs = Number(e.target.value)
    onSeek(startTime + offsetMs)
  }

  const speeds = [1, 5, 15]

  return (
    <div className="glass-panel p-5 rounded-xl space-y-4">
      {/* Time Tracking Range Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400 font-semibold font-mono">
          <span>Match Clock: {formatTime(elapsedMinutes, elapsedSeconds)}</span>
          <span>Timeline Position</span>
        </div>
        <input 
          type="range"
          min={0}
          max={maxVal}
          value={currentVal}
          onChange={handleSliderChange}
          className="w-full h-1.5 rounded-lg bg-gray-800 accent-cyan-500 cursor-pointer outline-none"
        />
      </div>

      {/* Button controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-2">
        {/* Playback Control button */}
        <button
          onClick={onPlayPause}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            isPlaying 
              ? 'bg-rose-500 hover:bg-rose-600 text-white glow-rose' 
              : 'bg-cyan-500 hover:bg-cyan-600 text-white glow-cyan'
          }`}
        >
          {isPlaying ? '⏸ Pause Replay' : '▶ Play Replay'}
        </button>

        {/* Speed Controller */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase font-display">Speed:</span>
          <div className="flex rounded-lg overflow-hidden border border-white/10 bg-white/5">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                  speed === s 
                    ? 'bg-cyan-500 text-white font-bold' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
