"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Minimal interfaces for SpeechRecognition to satisfy TS
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "id-ID"; // Indonesian

    // Handle standard browser DOM event when the mic actually activates
    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // event.results contains all results from the current session
      const fullTranscript = Array.from(event.results)
        .map((res) => res?.[0]?.transcript || "")
        .join("");

      setTranscript(fullTranscript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error);
      isStartingRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          recognitionRef.current.stop();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch(e) {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isStartingRef.current) {
      setTranscript("");
      isStartingRef.current = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        recognitionRef.current.start();
        // We do NOT set isListening=true here, we wait for the onstart event.
        // This prevents React state race conditions if start() throws synchronously.
      } catch (e: unknown) {
        isStartingRef.current = false;
        // The most common error is DOMException: recognition has already started
        if (e instanceof Error && e.name === "InvalidStateError") {
          console.warn("Speech recognition already started, ignoring.");
          setIsListening(true);
        } else {
          console.error(e);
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && (isListening || isStartingRef.current)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        recognitionRef.current.stop();
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "InvalidStateError") {
          console.error(e);
        }
      } finally {
        isStartingRef.current = false;
        setIsListening(false);
      }
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    setTranscript, // allow manual overrides if needed
    isSupported,
    startListening,
    stopListening
  };
}