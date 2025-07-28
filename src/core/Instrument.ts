import { NamedObject } from './Common';

/**
 * Instances of class Instrument render MIDI control inputs to audio signals.
 */
export interface Instrument extends NamedObject {
  /**
   * Initializes the instrument with the given audio context.
   * This can be an asynchronous operation, e.g. for loading samples.
   * @param context The audio context to use.
   */
  initialize(context: AudioContext): Promise<void>;

  /**
   * Connects the instrument's output to a destination node.
   * @param destination The destination node to connect to.
   */
  connect(destination: AudioNode): void;

  /**
   * Disconnects the instrument from any connected nodes.
   */
  disconnect(): void;

  /**
   * Triggers a note on event.
   * @param note The MIDI note number.
   * @param velocity The velocity of the note (0-127).
   * @param time The time at which the note should start, relative to the audio context's clock.
   */
  noteOn(note: number, velocity: number, time: number): void;

  /**
   * Triggers a note off event.
   * @param note The MIDI note number.
   * @param time The time at which the note should stop, relative to the audio context's clock.
   */
  noteOff(note: number, time: number): void;

  /**
   * Stops all currently playing notes immediately.
   */
  stopAll(): void;
}