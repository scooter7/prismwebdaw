import { Instrument } from '../core/Instrument';

// Declare WebAudioFontPlayer globally for TypeScript
declare global {
  interface Window {
    WebAudioFontPlayer: any;
  }
}

export class SoundFontInstrument implements Instrument {
  private player: any | null = null;
  public name: string;
  private instrumentId: string;

  constructor(instrumentName: string, instrumentId: string) {
    this.name = instrumentName;
    this.instrumentId = instrumentId;
  }

  async initialize(context: AudioContext): Promise<void> {
    if (!window.WebAudioFontPlayer) {
      // Dynamically load WebAudioFontPlayer if not already present
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://surikov.github.io/webaudiofont/dist/webaudiofont.js';
        script.onload = () => {
          this.player = new window.WebAudioFontPlayer();
          this.player.loader.decodeAfterLoading(context, this.player.loader.url);
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } else {
      this.player = new window.WebAudioFontPlayer();
      this.player.loader.decodeAfterLoading(context, this.player.loader.url);
    }

    return new Promise((resolve, reject) => {
      this.player.loader.loadInstrument(context, this.instrumentId, (buffer: AudioBuffer) => {
        if (buffer) {
          console.log(`WebAudioFont instrument '${this.name}' loaded successfully.`);
          resolve();
        } else {
          console.error(`Error loading WebAudioFont instrument '${this.name}' with ID '${this.instrumentId}'.`);
          reject(new Error(`Failed to load instrument: ${this.name}`));
        }
      });
    });
  }

  connect(destination: AudioNode): void {
    // WebAudioFontPlayer handles its own connections internally to the context's destination.
    // We'll manage the output through a gain node if needed for track volume/pan.
    // For now, we'll assume it connects directly to the context's destination.
    // If we need to route through the track's channel strip, we'd need to modify WebAudioFontPlayer's output.
    // For simplicity, we'll let it connect to the main output for now.
  }

  disconnect(): void {
    // WebAudioFontPlayer doesn't expose a direct disconnect method for its internal nodes.
    // To stop all sound, we rely on stopAll.
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this.player || !this.player.audioContext) return;
    
    // WebAudioFontPlayer uses 0-1 for velocity, and time is absolute audio context time
    this.player.queueWaveTable(
      this.player.audioContext,
      this.player.audioContext.destination, // Direct to destination for now
      this.player.loader.get  (this.instrumentId),
      time,
      note,
      1, // Duration in seconds, can be adjusted if needed
      velocity / 127 // Convert 0-127 velocity to 0-1
    );
  }

  noteOff(note: number, time: number): void {
    // WebAudioFontPlayer's queueWaveTable handles note duration, so a separate noteOff is not strictly needed
    // if we pass the correct duration in noteOn. However, for sustained notes or explicit stops,
    // we might need a more advanced approach or a custom ADSR envelope.
    // For now, we'll rely on the duration passed in noteOn.
  }

  stopAll(): void {
    // WebAudioFontPlayer doesn't have a direct "stop all" for all playing notes.
    // This would typically require tracking individual notes played and stopping them.
    // For now, we'll leave this as a no-op, or rely on the context being stopped.
    // If a more robust stopAll is needed, we'd have to implement note tracking.
  }
}