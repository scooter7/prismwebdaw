import { Instrument } from '../core/Instrument';

type DrumSample = {
  buffer: AudioBuffer | null;
  url: string;
};

const DRUM_SAMPLES: Record<number, string> = {
  36: 'https://ai-music.github.io/webdaw/library/samples/sample-pi/drums/one-shots/acoustic/ac_kick.flac', // Kick
  38: 'https://ai-music.github.io/webdaw/library/samples/sample-pi/drums/one-shots/acoustic/ac_snare.flac', // Snare
  42: 'https://ai-music.github.io/webdaw/library/samples/sample-pi/drums/one-shots/acoustic/ac_hihat_closed.flac', // Closed Hi-hat
};

export class Drums implements Instrument {
  readonly name = 'Drums';
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private samples: Record<number, DrumSample> = {};
  private isLoaded: boolean = false;

  async initialize(context: AudioContext): Promise<void> {
    this.context = context;
    this.output = context.createGain();
    // Load samples if not already loaded
    if (!this.isLoaded) {
      await Promise.all(
        Object.entries(DRUM_SAMPLES).map(async ([note, url]) => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await context.decodeAudioData(arrayBuffer);
          this.samples[Number(note)] = { buffer, url };
        })
      );
      this.isLoaded = true;
    }
  }

  connect(destination: AudioNode): void {
    this.output?.connect(destination);
  }

  disconnect(): void {
    this.output?.disconnect();
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this.context || !this.output) return;
    const sample = this.samples[note];
    if (!sample || !sample.buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = sample.buffer;

    const gain = this.context.createGain();
    gain.gain.value = (velocity ?? 100) / 127;

    source.connect(gain);
    gain.connect(this.output);

    source.start(time);
  }

  noteOff(_note: number, _time: number): void {
    // Drum samples are one-shots, so nothing to do here
  }

  stopAll(): void {
    // No persistent notes to stop
  }
}