import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDesktop,
  faMicrophone,
  faMicrophoneSlash,
  faPhone,
  faPhoneSlash,
  faVideo,
  faVideoSlash,
} from "@fortawesome/free-solid-svg-icons";
import type { CallState, CallPeer, CallType } from "../hooks/useCall";
import { formatCallDuration } from "../hooks/useCall";

interface CallOverlayProps {
  callState: CallState;
  peer: CallPeer | null;
  callType: CallType;
  callDuration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  callError: string | null;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onClearError: () => void;
}

export function CallOverlay({
  callState,
  peer,
  callType,
  callDuration,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  callError,
  remoteAudioRef,
  remoteVideoRef,
  localVideoRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onClearError,
}: CallOverlayProps) {
  if (callState === "idle" && !callError) return null;

  const typeText = callType === "video" ? "Video" : "Audio";
  const statusText =
    callState === "outgoing"
      ? `${typeText} call...`
      : callState === "incoming"
        ? `Incoming ${typeText.toLowerCase()} call`
        : callState === "connecting"
          ? "Connecting..."
          : callState === "connected"
            ? formatCallDuration(callDuration)
            : "";

  const showVideoUI = callType === "video" && callState === "connected";

  return (
    <>
      {/* Hidden audio element for audio calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {(callState !== "idle" || callError) && (
        <div className={`call-overlay ${showVideoUI ? "call-overlay--video-active" : ""}`}>
          {callError ? (
            <div className="call-overlay-card">
              <p className="call-overlay-error">{callError}</p>
              <button
                type="button"
                className="call-btn call-btn--end"
                onClick={onClearError}
              >
                OK
              </button>
            </div>
          ) : showVideoUI ? (
            /* Connected Video Call Layout */
            <div className="video-call-container">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="video-stream video-stream--remote"
              />

              <div className="video-local-wrapper">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`video-stream video-stream--local ${!isVideoEnabled && !isScreenSharing ? "video-stream--hidden" : ""} ${isScreenSharing ? "video-stream--screen" : ""}`}
                />
                {!isVideoEnabled && !isScreenSharing && (
                  <div className="video-local-placeholder">
                    <span>Camera off</span>
                  </div>
                )}
                {isScreenSharing && (
                  <div className="video-local-badge">Screen</div>
                )}
              </div>

              <div className="video-controls-panel">
                <div className="video-peer-info">
                  <h3 className="video-peer-name">{peer?.name}</h3>
                  <p className="video-call-duration">{formatCallDuration(callDuration)}</p>
                </div>
                <div className="video-actions">
                  <button
                    type="button"
                    className={`call-btn call-btn--mute ${isMuted ? "active" : ""}`}
                    onClick={onToggleMute}
                    aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                  >
                    <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
                  </button>
                  <button
                    type="button"
                    className={`call-btn call-btn--video ${!isVideoEnabled ? "active" : ""}`}
                    onClick={onToggleVideo}
                    disabled={isScreenSharing}
                    aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                  >
                    <FontAwesomeIcon icon={isVideoEnabled ? faVideo : faVideoSlash} />
                  </button>
                  <button
                    type="button"
                    className={`call-btn call-btn--screen ${isScreenSharing ? "active" : ""}`}
                    onClick={onToggleScreenShare}
                    aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
                    title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
                  >
                    <FontAwesomeIcon icon={faDesktop} />
                  </button>
                  <button
                    type="button"
                    className="call-btn call-btn--end"
                    onClick={onEnd}
                    aria-label="End call"
                  >
                    <FontAwesomeIcon icon={faPhoneSlash} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Audio Call / Connecting Video Call Layout */
            <div className="call-overlay-card">
              <div className="call-overlay-avatar">
                {(peer?.name || "?")[0].toUpperCase()}
              </div>
              <h3 className="call-overlay-name">{peer?.name}</h3>
              <p className="call-overlay-status">{statusText}</p>

              <div className="call-overlay-actions">
                {callState === "incoming" && (
                  <>
                    <button
                      type="button"
                      className="call-btn call-btn--accept"
                      onClick={onAccept}
                      aria-label="Accept"
                    >
                      <FontAwesomeIcon icon={faPhone} />
                    </button>
                    <button
                      type="button"
                      className="call-btn call-btn--reject"
                      onClick={onReject}
                      aria-label="Decline"
                    >
                      <FontAwesomeIcon icon={faPhoneSlash} />
                    </button>
                  </>
                )}

                {(callState === "outgoing" || callState === "connecting") && (
                  <button
                    type="button"
                    className="call-btn call-btn--end"
                    onClick={onEnd}
                    aria-label="Cancel"
                  >
                    <FontAwesomeIcon icon={faPhoneSlash} />
                  </button>
                )}

                {callState === "connected" && (
                  <>
                    <button
                      type="button"
                      className={`call-btn call-btn--mute ${isMuted ? "active" : ""}`}
                      onClick={onToggleMute}
                      aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                    >
                      <FontAwesomeIcon
                        icon={isMuted ? faMicrophoneSlash : faMicrophone}
                      />
                    </button>
                    <button
                      type="button"
                      className="call-btn call-btn--end"
                      onClick={onEnd}
                      aria-label="End call"
                    >
                      <FontAwesomeIcon icon={faPhoneSlash} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
