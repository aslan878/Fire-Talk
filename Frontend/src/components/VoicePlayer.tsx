import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faPause } from "@fortawesome/free-solid-svg-icons";

interface VoicePlayerProps {
  url: string;
  durationSec?: number | null;
  isOwn?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ url, durationSec, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

  const initAudio = () => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(url);
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (!durationSec && audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    audioCleanupRef.current = () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };

    return audio;
  };

  useEffect(() => {
    // Reset player states and clean up old audio if URL changes
    setCurrentTime(0);
    setDuration(durationSec || 0);
    setIsPlaying(false);
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }
  }, [url, durationSec]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
    };
  }, []);

  const togglePlayback = () => {
    const audio = initAudio();
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error("Audio playback error:", err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = initAudio();
    const value = parseFloat(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const currentProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`voice-player-container ${isOwn ? "voice-own" : "voice-other"}`}>
      <button 
        type="button" 
        onClick={togglePlayback} 
        className="voice-play-pause-btn"
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
      </button>

      <div className="voice-player-slider-wrapper">
        <input
          ref={progressRef}
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="voice-player-progress"
          style={{
            background: `linear-gradient(to right, ${
              isOwn ? "white" : "var(--primary)"
            } ${currentProgressPercent}%, rgba(255, 255, 255, 0.2) ${currentProgressPercent}%)`
          }}
        />
        <div className="voice-player-time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
