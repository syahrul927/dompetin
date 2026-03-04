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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // event.results contains all results from the current session
      const fullTranscript = Array.from(event.results)
        .map((res) => res?.[0]?.transcript || "")
        .join("");

      setTranscript(fullTranscript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
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
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening, setTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.error(e);
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