// A drum sampler utilizing samples proccessed by the traditional filter -> amplifier signal flow.

import { Instrument } from '../core/Instrument';

export class Drums implements Instrument {
  readonly name = 'Drums';

  initialize(context: AudioContext): void {
    // Not implemented
  }

  connect(destination: AudioNode): void {
    // Not implemented
  }

  disconnect(): void {
    // Not implemented
  }

  noteOn(note: number, velocity: number, time: number): void {
    // Not implemented
  }

  noteOff(note: number, time: number): void {
    // Not implemented
  }

  stopAll(): void {
    // Not implemented
  }
}