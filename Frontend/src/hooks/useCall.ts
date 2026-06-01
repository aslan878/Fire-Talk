import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export type CallState = "idle" | "outgoing" | "incoming" | "connecting" | "connected";
export type CallType = "audio" | "video";

export interface CallPeer {
  userId: string;
  name: string;
  chatId: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

function createCallId(userA: string, userB: string) {
  return [userA, userB].sort().join("_");
}

export function useCall(
  socket: Socket | null,
  currentUserId: string,
) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerRef = useRef<CallPeer | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const callTypeRef = useRef<CallType>("audio");
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitiatorRef = useRef(false);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }, [stopDurationTimer]);

  const cleanup = useCallback(() => {
    stopDurationTimer();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    callIdRef.current = null;
    isInitiatorRef.current = false;
    setIsMuted(false);
    setIsVideoEnabled(true);
    setCallDuration(0);
    setCallError(null);
  }, [stopDurationTimer]);

  const resetCall = useCallback(() => {
    cleanup();
    setCallState("idle");
    setPeer(null);
  }, [cleanup]);

  const getLocalStream = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (callId: string, remoteUserId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc:ice-candidate", {
            callId,
            toUserId: remoteUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setCallError("Соединение потеряно");
        }
      };

      return pc;
    },
    [socket],
  );

  const addLocalTracks = useCallback(
    (pc: RTCPeerConnection, stream: MediaStream) => {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    },
    [],
  );

  const endCall = useCallback(() => {
    const currentPeer = peerRef.current;
    const callId = callIdRef.current;
    if (socket && currentPeer && callId) {
      socket.emit("call:end", {
        callId,
        toUserId: currentPeer.userId,
      });
    }
    resetCall();
  }, [socket, resetCall]);

  const rejectCall = useCallback(() => {
    const currentPeer = peerRef.current;
    const callId = callIdRef.current;
    if (socket && currentPeer && callId) {
      socket.emit("call:reject", {
        callId,
        toUserId: currentPeer.userId,
      });
    }
    resetCall();
  }, [socket, resetCall]);

  const acceptCall = useCallback(async () => {
    const currentPeer = peerRef.current;
    const callId = callIdRef.current;
    const currentCallType = callTypeRef.current;
    if (!socket || !currentPeer || !callId) return;

    try {
      const stream = await getLocalStream(currentCallType);
      const pc = createPeerConnection(callId, currentPeer.userId);
      addLocalTracks(pc, stream);
      setCallState("connecting");

      socket.emit("call:accept", {
        callId,
        toUserId: currentPeer.userId,
      });
    } catch (e) {
      console.error("acceptCall media error:", e);
      setCallError(
        currentCallType === "video"
          ? "Не удалось получить доступ к камере или микрофону"
          : "Не удалось получить доступ к микрофону"
      );
      rejectCall();
    }
  }, [
    socket,
    getLocalStream,
    createPeerConnection,
    addLocalTracks,
    rejectCall,
  ]);

  const startCall = useCallback(
    async (targetUserId: string, targetName: string, chatId: string, type: CallType) => {
      if (!socket || callStateRef.current !== "idle") return;

      const callId = createCallId(currentUserId, targetUserId);
      callIdRef.current = callId;
      isInitiatorRef.current = true;
      setCallType(type);

      const callPeer: CallPeer = {
        userId: targetUserId,
        name: targetName,
        chatId,
      };
      setPeer(callPeer);
      setCallState("outgoing");

      socket.emit("call:invite", {
        callId,
        toUserId: targetUserId,
        fromUserName:
          JSON.parse(localStorage.getItem("chat_user") || "{}").name || "User",
        chatId,
        callType: type,
      });
    },
    [socket, currentUserId],
  );

  const createAndSendOffer = useCallback(
    async (callId: string, remoteUserId: string) => {
      const currentCallType = callTypeRef.current;
      try {
        const stream = await getLocalStream(currentCallType);
        const pc = createPeerConnection(callId, remoteUserId);
        addLocalTracks(pc, stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit("webrtc:offer", {
          callId,
          toUserId: remoteUserId,
          offer,
        });
      } catch (e) {
        console.error("createAndSendOffer error:", e);
        setCallError(
          currentCallType === "video"
            ? "Не удалось начать видеозвонок"
            : "Не удалось начать аудиозвонок"
        );
        endCall();
      }
    },
    [socket, getLocalStream, createPeerConnection, addLocalTracks, endCall],
  );

  const handleRemoteAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("connected");
      startDurationTimer();
    },
    [startDurationTimer],
  );

  const handleRemoteOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const currentPeer = peerRef.current;
      const callId = callIdRef.current;
      if (socket && currentPeer && callId) {
        socket.emit("webrtc:answer", {
          callId,
          toUserId: currentPeer.userId,
          answer,
        });
      }
      setCallState("connected");
      startDurationTimer();
    },
    [socket, startDurationTimer],
  );

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoEnabled(videoTrack.enabled);
  }, []);

  // Bind streams to video / audio elements when they are mounted and streams change.
  // callState is included as a dependency so these re-run when callState becomes
  // "connected" and the video elements mount in CallOverlay for the first time.
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (!remoteStream) return;
    if (callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => {});
    } else if (callType === "audio" && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, callType, callState]);

  useEffect(() => {
    if (!socket) return;

    const onInvite = (payload: {
      callId: string;
      fromUserId: string;
      fromUserName: string;
      chatId: string;
      callType?: CallType;
    }) => {
      if (callStateRef.current !== "idle") {
        socket.emit("call:busy", {
          callId: payload.callId,
          toUserId: payload.fromUserId,
        });
        return;
      }

      callIdRef.current = payload.callId;
      isInitiatorRef.current = false;
      setCallType(payload.callType || "audio");
      setPeer({
        userId: payload.fromUserId,
        name: payload.fromUserName,
        chatId: payload.chatId,
      });
      setCallState("incoming");
    };

    const onAccept = (payload: { callId: string; fromUserId: string }) => {
      if (
        !isInitiatorRef.current ||
        callIdRef.current !== payload.callId
      ) {
        return;
      }
      void createAndSendOffer(payload.callId, payload.fromUserId);
      setCallState("connecting");
    };

    const onReject = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      setCallError("Абонент отклонил звонок");
      resetCall();
    };

    const onEnd = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      resetCall();
    };

    const onBusy = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      setCallError("Абонент занят");
      resetCall();
    };

    const onOffer = (payload: {
      callId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (callIdRef.current !== payload.callId) return;
      void handleRemoteOffer(payload.offer);
    };

    const onAnswer = (payload: {
      callId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (callIdRef.current !== payload.callId) return;
      void handleRemoteAnswer(payload.answer);
    };

    const onIceCandidate = (payload: {
      callId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (callIdRef.current !== payload.callId || !pcRef.current) return;
      void pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    };

    socket.on("call:invite", onInvite);
    socket.on("call:accept", onAccept);
    socket.on("call:reject", onReject);
    socket.on("call:end", onEnd);
    socket.on("call:busy", onBusy);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIceCandidate);

    return () => {
      socket.off("call:invite", onInvite);
      socket.off("call:accept", onAccept);
      socket.off("call:reject", onReject);
      socket.off("call:end", onEnd);
      socket.off("call:busy", onBusy);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIceCandidate);
    };
  }, [
    socket,
    createAndSendOffer,
    resetCall,
    handleRemoteOffer,
    handleRemoteAnswer,
  ]);

  useEffect(() => () => cleanup(), [cleanup]);

  const isInCall = callState !== "idle";

  return {
    callState,
    peer,
    callType,
    isInCall,
    isMuted,
    isVideoEnabled,
    callDuration,
    callError,
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    clearError: () => setCallError(null),
  };
}

export function formatCallDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
