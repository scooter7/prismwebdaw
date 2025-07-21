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
    console.log(`SoundFontInstrument: Initializing instrument '${this.name}' with ID '${this.instrumentId}'.`);
    if (this._isInitialized) {
      console.log(`SoundFontInstrument: '${this.name}' already initialized.`);
      return; // Already initialized
    }

    if (!window.WebAudioFontPlayer) {
      console.log(`SoundFontInstrument: WebAudioFontPlayer script not found, loading it.`);
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        // Changed to a more reliable CDN for WebAudioFontPlayer
        script.src = 'https://cdn.jsdelivr.net/npm/webaudiofont@latest/dist/webaudiofont.js';
        script.onload = () => {
          this.player = new window.WebAudioFontPlayer();
          console.log(`SoundFontInstrument: WebAudioFontPlayer script loaded.`);
          resolve();
        };
        script.onerror = (e) => {
          console.error("SoundFontInstrument: Failed to load WebAudioFontPlayer script:", e);
          reject(new Error("Failed to load WebAudioFontPlayer script."));
        };
        document.head.appendChild(script);
      });
    } else {
      this.player = new window.WebAudioFontPlayer();
      console.log(`SoundFontInstrument: WebAudioFontPlayer already available.`);
    }

    return new Promise((resolve, reject) => {
      console.log(`SoundFontInstrument: Loading instrument data for '${this.name}'.`);
      this.player.loader.loadInstrument(context, this.instrumentId, (buffer: AudioBuffer) => {
        if (buffer) {
          console.log(`SoundFontInstrument: Instrument '${this.name}' loaded successfully.`);
          this._isInitialized = true;
          resolve();
        } else {
          console.error(`SoundFontInstrument: Error loading instrument '${this.name}' with ID '${this.instrumentId}': Buffer is null.`);
          reject(new Error(`Failed to load instrument: ${this.name}`));
        }
      }, (error: any) => { // Add error callback for loadInstrument
        console.error(`SoundFontInstrument: Error loading instrument '${this.name}' with ID '${this.instrumentId}':`, error);
        reject(new Error(`Failed to load instrument: ${this.name}`));
      });
    });
  }

  connect(destination: AudioNode): void {
    console.log(`SoundFontInstrument: Connecting '${this.name}' to destination.`);
    this._destinationNode = destination; // Store the destination node
  }

  disconnect(): void {
    console.log(`SoundFontInstrument: Disconnecting '${this.name}'.`);
    // WebAudioFontPlayer doesn't expose a direct disconnect method for its internal nodes.
    // To stop all sound, we rely on stopAll.
    this._destinationNode = null; // Clear the reference
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this._isInitialized || !this.player || !this.player.audioContext || !this._destinationNode) {
      console.warn(`SoundFontInstrument: Attempted to play note on uninitialized or unconnected instrument: ${this.name}`);
      return;
    }
    console.log(`SoundFontInstrument: Playing note ${note} on '${this.name}' at time ${time}.`);
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
    console.log(`SoundFontInstrument: Note off for ${note} on '${this.name}' at time ${time}. (Handled by queueWaveTable duration)`);
  }

  stopAll(): void {
    if (!this.player || !this.player.audioContext) return;
    console.log(`SoundFontInstrument: Stopping all notes on '${this.name}'.`);
    // WebAudioFontPlayer doesn't have a direct "stop all" for all playing notes.
    // This would typically require tracking individual notes played and stopping them.
    // For now, we'll leave this as a no-op, or rely on the context being stopped.
  }
}