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
  private _isInitialized: boolean = false;
  private _destinationNode: AudioNode | null = null; // Store the connected destination node

  constructor(instrumentName: string, instrumentId: string) {
    this.name = instrumentName;
    this.instrumentId = instrumentId;
  }

  async initialize(context: AudioContext): Promise<void> {
    if (this._isInitialized) {
      return; // Already initialized
    }

    if (!window.WebAudioFontPlayer) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://surikov.github.io/webaudiofont/dist/webaudiofont.js';
        script.onload = () => {
          this.player = new window.WebAudioFontPlayer();
          resolve();
        };
        script.onerror = (e) => {
          console.error("Failed to load WebAudioFontPlayer script:", e);
          reject(new Error("Failed to load WebAudioFontPlayer script."));
        };
        document.head.appendChild(script);
      });
    } else {
      this.player = new window.WebAudioFontPlayer();
    }

    return new Promise((resolve, reject) => {
      this.player.loader.loadInstrument(context, this.instrumentId, (buffer: AudioBuffer) => {
        if (buffer) {
          console.log(`WebAudioFont instrument '${this.name}' loaded successfully.`);
          this._isInitialized = true;
          resolve();
        } else {
          console.error(`Error loading WebAudioFont instrument '${this.name}' with ID '${this.instrumentId}'.`);
          reject(new Error(`Failed to load instrument: ${this.name}`));
        }
      }, (error: any) => { // Add error callback for loadInstrument
        console.error(`Error loading WebAudioFont instrument '${this.name}' with ID '${this.instrumentId}':`, error);
        reject(new Error(`Failed to load instrument: ${this.name}`));
      });
    });
  }

  connect(destination: AudioNode): void {
    this._destinationNode = destination; // Store the destination node
  }

  disconnect(): void {
    // WebAudioFontPlayer doesn't expose a direct disconnect method for its internal nodes.
    // To stop all sound, we rely on stopAll.
    this._destinationNode = null; // Clear the reference
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this._isInitialized || !this.player || !this.player.audioContext || !this._destinationNode) {
      console.warn(`Attempted to play note on uninitialized or unconnected instrument: ${this.name}`);
      return;
    }
    
    this.player.queueWaveTable(
      this.player.audioContext,
      this._destinationNode, // Use the stored destination node
      this.player.loader.get(this.instrumentId),
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
  }
}