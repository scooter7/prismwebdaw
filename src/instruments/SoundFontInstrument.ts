import { Instrument } from '../core/Instrument';
import { WebAudioFontPlayer } from 'webaudiofont';

export class SoundFontInstrument implements Instrument {
  private player: any = null;
  public name: string;
  private instrumentId: string;
  private _isInitialized: boolean = false;
  private _destinationNode: AudioNode | null = null;

  constructor(instrumentName: string, instrumentId: string) {
    this.name = instrumentName;
    this.instrumentId = instrumentId;
  }

  async initialize(context: AudioContext): Promise<void> {
    console.log(`SoundFontInstrument: Initializing instrument '${this.name}' with ID '${this.instrumentId}'.`);
    if (this._isInitialized) {
      console.log(`SoundFontInstrument: '${this.name}' already initialized.`);
      return;
    }

    this.player = new WebAudioFontPlayer();
    console.log(`SoundFontInstrument: WebAudioFontPlayer initialized.`);

    return new Promise((resolve, reject) => {
      console.log(`SoundFontInstrument: Loading instrument data for '${this.name}'.`);
      this.player.loader.loadInstrument(
        context,
        this.instrumentId,
        (buffer: AudioBuffer) => {
          if (buffer) {
            console.log(`SoundFontInstrument: Instrument '${this.name}' loaded successfully.`);
            this._isInitialized = true;
            resolve();
          } else {
            console.error(`SoundFontInstrument: Error loading instrument '${this.name}' with ID '${this.instrumentId}': Buffer is null.`);
            reject(new Error(`Failed to load instrument: ${this.name}`));
          }
        },
        (error: any) => {
          console.error(`SoundFontInstrument: Error loading instrument '${this.name}' with ID '${this.instrumentId}':`, error);
          reject(new Error(`Failed to load instrument: ${this.name}`));
        }
      );
    });
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