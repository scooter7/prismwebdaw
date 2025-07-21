import { Instrument } from '../core/Instrument';
import type WebAudioFontPlayer from 'webaudiofont';

// A global promise to ensure the script is only loaded once.
let webaudiofontPromise: Promise<any> | null = null;

export class SoundFontInstrument implements Instrument {
  private player: WebAudioFontPlayer | null = null;
  public name: string;
  private instrumentId: string;
  private _isInitialized: boolean = false;
  private _destinationNode: AudioNode | null = null;

  constructor(instrumentName: string, instrumentId: string) {
    this.name = instrumentName;
    this.instrumentId = instrumentId;
  }

  private loadScript(): Promise<any> {
    if (webaudiofontPromise) {
      return webaudiofontPromise;
    }
    webaudiofontPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // This path assumes the library is in node_modules and accessible via a public path.
      // We point directly to the required file inside the package.
      script.src = 'https://cdn.jsdelivr.net/npm/webaudiofont@2.9.0/dist/WebAudioFontPlayer.js';
      script.onload = () => {
        console.log('WebAudioFontPlayer script loaded successfully.');
        resolve((window as any).WebAudioFontPlayer);
      };
      script.onerror = () => {
        console.error('Failed to load WebAudioFontPlayer script.');
        reject(new Error('Failed to load WebAudioFontPlayer script.'));
      };
      document.head.appendChild(script);
    });
    return webaudiofontPromise;
  }

  async initialize(context: AudioContext): Promise<void> {
    console.log(`SoundFontInstrument: Initializing instrument '${this.name}' with ID '${this.instrumentId}'.`);
    if (this._isInitialized) {
      console.log(`SoundFontInstrument: '${this.name}' already initialized.`);
      return;
    }

    try {
      const Player = await this.loadScript();
      this.player = new Player();
      console.log(`SoundFontInstrument: WebAudioFontPlayer initialized from global scope.`);

      return new Promise((resolve, reject) => {
        console.log(`SoundFontInstrument: Loading instrument data for '${this.name}'.`);
        this.player!.loader.loadInstrument(
          context,
          this.instrumentId,
          (buffer: AudioBuffer) => {
            if (buffer) {
              console.log(`SoundFontInstrument: Instrument '${this.name}' loaded successfully.`);
              this._isInitialized = true;
              resolve();
            } else {
              const errorMsg = `Error loading instrument '${this.name}' with ID '${this.instrumentId}': Buffer is null.`;
              console.error(errorMsg);
              reject(new Error(errorMsg));
            }
          },
          (error: any) => {
            const errorMsg = `Error loading instrument '${this.name}' with ID '${this.instrumentId}':`;
            console.error(errorMsg, error);
            reject(new Error(`${errorMsg} ${error}`));
          }
        );
      });
    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }
  }

  connect(destination: AudioNode): void {
    console.log(`SoundFontInstrument: Connecting '${this.name}' to destination.`);
    this._destinationNode = destination;
  }

  disconnect(): void {
    console.log(`SoundFontInstrument: Disconnecting '${this.name}'.`);
    this._destinationNode = null;
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this._isInitialized || !this.player || !this.player.audioContext || !this._destinationNode) {
      console.warn(`SoundFontInstrument: Attempted to play note on uninitialized or unconnected instrument: ${this.name}`);
      return;
    }
    console.log(`SoundFontInstrument: Playing note ${note} on '${this.name}' at time ${time}.`);
    this.player.queueWaveTable(
      this.player.audioContext,
      this._destinationNode,
      this.player.loader.get(this.instrumentId),
      time,
      note,
      1,
      velocity / 127
    );
  }

  noteOff(note: number, time: number): void {
    // WebAudioFontPlayer's queueWaveTable handles note duration, so a separate noteOff is not strictly needed
    console.log(`SoundFontInstrument: Note off for ${note} on '${this.name}' at time ${time}. (Handled by queueWaveTable duration)`);
  }

  stopAll(): void {
    if (!this.player || !this.player.audioContext) return;
    console.log(`SoundFontInstrument: Stopping all notes on '${this.name}'.`);
    // No direct "stop all" in WebAudioFontPlayer; rely on context stop or implement note tracking if needed.
  }
}