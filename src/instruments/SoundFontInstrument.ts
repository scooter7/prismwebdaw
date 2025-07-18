import { Instrument } from '../core/Instrument';
import * as Tone from 'tone';

const pianoSamples = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', A7: 'A7.mp3', C8: 'C8.mp3',
};
const pianoBaseUrl = 'https://tonejs.github.io/audio/salamander/';

// Using samples from https://github.com/Tonejs/Tone.js/tree/master/examples/audio/drum-machine
const drumSamples = {
  'C2': 'kick.mp3',       // MIDI 36
  'D2': 'snare.mp3',      // MIDI 38
  'D#2': 'clap.mp3',      // MIDI 39
  'F#2': 'hihat.mp3',     // MIDI 42
  'A#2': 'hihat-open.mp3',// MIDI 46
  'C#3': 'crash.mp3',     // MIDI 49
};
const drumBaseUrl = 'https://tonejs.github.io/audio/drum-machine/';

export class SoundFontInstrument implements Instrument {
  private sampler: Tone.Sampler | null = null;
  public name: string;

  constructor(instrumentName: string) {
    this.name = instrumentName;
  }

  async initialize(context: AudioContext): Promise<void> {
    // Use the existing AudioContext with Tone.js
    Tone.setContext(context);

    let urls, baseUrl;
    if (this.name === 'drums') {
        urls = drumSamples;
        baseUrl = drumBaseUrl;
    } else { // default to piano
        this.name = 'acoustic_grand_piano'; // ensure name is correct for logging
        urls = pianoSamples;
        baseUrl = pianoBaseUrl;
    }

    this.sampler = new Tone.Sampler({
      urls,
      baseUrl,
      release: 1,
    });

    // Wait for the sampler to load all the audio files
    await this.sampler.loaded;
    console.log(`Tone.js Sampler instrument '${this.name}' loaded.`);
  }

  connect(destination: AudioNode): void {
    if (this.sampler) {
      this.sampler.connect(destination);
    }
  }

  disconnect(): void {
    this.sampler?.disconnect();
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this.sampler) return;
    const freq = Tone.Frequency(note, 'midi');
    const vel = velocity / 127;
    this.sampler.triggerAttack(freq.toNote(), time, vel);
  }

  noteOff(note: number, time: number): void {
    if (!this.sampler) return;
    const freq = Tone.Frequency(note, 'midi');
    this.sampler.triggerRelease([freq.toNote()], time);
  }

  stopAll(): void {
    this.sampler?.releaseAll();
  }
}