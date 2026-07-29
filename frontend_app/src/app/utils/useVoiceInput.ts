/**
 * useVoiceInput.ts
 *
 * Microphone capture -> local Whisper transcription.
 * Records with MediaRecorder (webm/opus) and POSTs the blob to the backend
 * /stt/transcribe endpoint (faster-whisper, fully local).
 */

import { useCallback, useRef, useState } from "react";

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error";

interface UseVoiceInputOptions {
  sessionUrl: string | null;
  onTranscript: (text: string) => void;
}

export function useVoiceInput({ sessionUrl, onTranscript }: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    setError(null);
    if (!sessionUrl) {
      setError("Backend not connected.");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDeaethel.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 2000) {
          // Too short to contain speech — treat as cancel.
          setState("idle");
          return;
        }
        setState("transcribing");
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice_input.webm");
          const res = await fetch(`${sessionUrl.replace(/\/+$/, "")}/stt/transcribe`, {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail?.detail || `STT server error (HTTP ${res.status})`);
          }
          const data = await res.json();
          const text = (data.text || "").trim();
          if (text) onTranscript(text);
          setState("idle");
        } catch (err: any) {
          setError(err?.message || "Transcription failed.");
          setState("error");
          setTimeout(() => setState("idle"), 2500);
        }
      };

      recorder.start();
      setState("recording");
    } catch (err: any) {
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone permission denied."
          : err?.message || "Could not start recording."
      );
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }, [sessionUrl, onTranscript]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopTracks();
      setState("idle");
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onstop = () => {
        stopTracks();
        chunksRef.current = [];
        setState("idle");
      };
      rec.stop();
    } else {
      stopTracks();
      setState("idle");
    }
  }, []);

  return { state, error, startRecording, stopRecording, cancelRecording };
}
