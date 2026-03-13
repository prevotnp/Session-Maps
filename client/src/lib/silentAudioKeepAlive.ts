let audioContext: AudioContext | null = null;
let oscillatorNode: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let isActive = false;

/**
 * Start a silent audio loop to prevent mobile browsers from suspending
 * JavaScript execution when the PWA is backgrounded.
 * Uses a 1 Hz oscillator (below human hearing) with near-zero gain.
 */
export function startKeepAlive(): void {
  if (isActive) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    oscillatorNode = audioContext.createOscillator();
    oscillatorNode.frequency.setValueAtTime(1, audioContext.currentTime);

    gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);

    oscillatorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillatorNode.start();
    isActive = true;
  } catch (error) {
    console.warn('[KeepAlive] Failed to start silent audio:', error);
  }
}

/**
 * Stop the silent audio loop. Call when the app returns to foreground
 * or when location sharing ends.
 */
export function stopKeepAlive(): void {
  if (!isActive) return;

  try {
    if (oscillatorNode) {
      oscillatorNode.stop();
      oscillatorNode.disconnect();
      oscillatorNode = null;
    }

    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }

    isActive = false;
  } catch (error) {
    console.warn('[KeepAlive] Failed to stop silent audio:', error);
  }
}

export function isKeepAliveRunning(): boolean {
  return isActive;
}
