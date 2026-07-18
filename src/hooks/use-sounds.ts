import { useCallback } from "react";

export function useSounds() {
  const playSound = useCallback((type: "click" | "activation" | "creation") => {
    if (typeof window === "undefined") return;
    
    // Check if sounds are explicitly enabled in localStorage
    const isEnabled = localStorage.getItem("omniscript-sounds-enabled") === "true";
    if (!isEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      
      // Prevent browser autoplay warning or suspended state issues
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (type === "click") {
        // Futuristic short click: a sweet, high-frequency subtle chirp
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        // Fast pitch sweep from 1400Hz down to 1000Hz for mechanical/digital feel
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.06);

        // Gentle volume curve to prevent clicking popping noise
        gainNode.gain.setValueAtTime(0.06, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === "activation") {
        // Upward pitch sweep: device initializing
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25);

        // Add a subtle sub-harmonic layer
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(160, now);
        osc2.frequency.exponentialRampToValueAtTime(440, now + 0.25);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.linearRampToValueAtTime(2000, now + 0.25);

        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
      } else if (type === "creation") {
        // Rich, sci-fi major-third chord chime
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.04, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          // Stagger the frequencies slightly for an arpeggiated sparkle
          osc.frequency.setValueAtTime(freq, now + i * 0.03);
          
          osc.connect(gainNode);
          osc.start(now + i * 0.03);
          osc.stop(now + 0.45);
        });

        gainNode.connect(ctx.destination);
      }
    } catch (e) {
      console.warn("Web Audio playback failed:", e);
    }
  }, []);

  return { playSound };
}
