// An analog synthesizer following the traditional oscillator -> filter -> amplifier signal flow.

import { Instrument } from '../core/Instrument';

type ActiveNote = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

function midiToFrequency(midi: number): number {
  return Math.pow(2, (midi - 69) / 12) * 440;
}

export class Analog implements Instrument {
  readonly name = 'Analog';
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private activeOscillators: Map<number, ActiveNote> = new Map();

  initialize(context: AudioContext) {
    this.context = context;
    this.output = this.context.createGain();
  }

  connect(destination: AudioNode) {
    this.output?.connect(destination);
  }

  disconnect() {
    this.output?.disconnect();
  }

  noteOn(note: number, velocity: number, time: number) {
    if (!this.context || !this.output) return;

    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(midiToFrequency(note), time);
    oscillator.type = 'sawtooth';

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity / 127, time + 0.01); // Quick attack

    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(time);

    this.activeOscillators.set(note, { oscillator, gain });
  }

  noteOff(note: number, time: number) {
    const activeNote = this.activeOscillators.get(note);
    if (activeNote) {
      // Simple release envelope
      activeNote.gain.gain.setValueAtTime(activeNote.gain.gain.value, time);
      activeNote.gain.gain.linearRampToValueAtTime(0, time + 0.2); // 200ms release
      activeNote.oscillator.stop(time + 0.2);
      this.activeOscillators.delete(note);
    }
  }

  stopAll() {
    const now = this.context?.currentTime ?? 0;
    this.activeOscillators.forEach((note) => {
      note.oscillator.stop(now);
    });
    this.activeOscillators.clear();
  }
}