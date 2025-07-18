import { Instrument } from '../core/Instrument';
import Soundfont, { Player } from 'soundfont-player';

export class SoundFontInstrument implements Instrument {
  private player: Player | null = null;
  private activeNotes: Map<number, any> = new Map();

  constructor(public readonly name: string) {}

  async initialize(context: AudioContext): Promise<void> {
    try {
      this.player = await Soundfont.instrument(context, this.name as any, {
        soundfont: 'MusyngKite',
      });
      console.log(`Soundfont instrument '${this.name}' loaded.`);
    } catch (error) {
      console.error(`Failed to load soundfont instrument: ${this.name}`, error);
      // Fallback to a default sound or handle error appropriately
    }
  }

  connect(destination: AudioNode): void {
    this.player?.connect(destination);
  }

  disconnect(): void {
    this.player?.disconnect();
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this.player) return;
    const node = this.player.play(note.toString(), time, {
      gain: velocity / 127,
    });
    this.activeNotes.set(note, node);
  }

  noteOff(note: number, time: number): void {
    const activeNote = this.activeNotes.get(note);
    if (activeNote) {
      activeNote.stop(time);
      this.activeNotes.delete(note);
    }
  }

  stopAll(): void {
    this.player?.stop();
    this.activeNotes.clear();
  }
}