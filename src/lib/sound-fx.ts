// Web Audio API procedural sound synthesizer and Telegram Haptic integration
// No external assets required, 0ms load delay, instant playback

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let hapticEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (typeof window !== "undefined") {
    localStorage.setItem("sound_enabled", enabled ? "1" : "0");
  }
}

export function setHapticEnabled(enabled: boolean) {
  hapticEnabled = enabled;
  if (typeof window !== "undefined") {
    localStorage.setItem("haptic_enabled", enabled ? "1" : "0");
  }
}

export function initSoundSettings() {
  if (typeof window !== "undefined") {
    soundEnabled = localStorage.getItem("sound_enabled") !== "0";
    hapticEnabled = localStorage.getItem("haptic_enabled") !== "0";
  }
}

export function getSoundEnabled() {
  return soundEnabled;
}

export function getHapticEnabled() {
  return hapticEnabled;
}

let lastHapticTime = 0;
let lastTapSoundTime = 0;

// Telegram Haptics helper
export function triggerHaptic(
  type: "light" | "medium" | "heavy" | "rigid" | "soft" | "selection" | "success" | "warning" | "error" = "light"
) {
  if (!hapticEnabled || typeof window === "undefined") return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Throttle high-frequency light taps to prevent saturating the Telegram WebView bridge
  if (type === "light" && now - lastHapticTime < 45) {
    return;
  }
  lastHapticTime = now;

  try {
    const twa = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: {
      impactOccurred: (style: string) => void;
      notificationOccurred: (type: string) => void;
      selectionChanged: () => void;
    } } } }).Telegram?.WebApp?.HapticFeedback;

    if (twa) {
      if (type === "selection") {
        twa.selectionChanged();
      } else if (type === "success" || type === "warning" || type === "error") {
        twa.notificationOccurred(type);
      } else {
        twa.impactOccurred(type);
      }
    } else if ("vibrate" in navigator) {
      if (type === "heavy" || type === "error") {
        navigator.vibrate([20, 30, 20]);
      } else if (type === "medium" || type === "warning") {
        navigator.vibrate(25);
      } else {
        navigator.vibrate(10);
      }
    }
  } catch {
    // Ignore haptic failures
  }
}

// Procedural tap click sound with combo pitch scaling
export function playTapSound(comboLevel = 0) {
  if (!soundEnabled) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastTapSoundTime < 35) {
    return;
  }
  lastTapSoundTime = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 380 + Math.min(comboLevel * 18, 400);
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // AudioContext blocked
  }
}

// Critical hit sound
export function playCritSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(220, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  } catch {}
}

// Coin bell sound
export function playCoinSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.04); // E6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start(ctx.currentTime + 0.04);
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch {}
}

// Level Up Fanfare
export function playLevelUpSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4 chord
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.07;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.32);
    });
  } catch {}
}

// Duel suspense roll sound
export function playDuelRollSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    for (let i = 0; i < 15; i++) {
      const delay = Math.pow(i / 15, 1.8) * 1.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const time = ctx.currentTime + delay;

      osc.type = "square";
      osc.frequency.setValueAtTime(400 + i * 25, time);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.035);
    }
  } catch {}
}
