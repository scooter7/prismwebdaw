declare global {
  class WebAudioFontPlayer {
    constructor();
    loader: {
      loadInstrument(
        context: AudioContext,
        instrumentId: string,
        onloaded: (buffer: AudioBuffer) => void,
        onerror?: (error: any) => void
      ): void;
      get(instrumentId: string): any;
    };
    audioContext: AudioContext;
    queueWaveTable(
      context: AudioContext,
      destination: AudioNode,
      instrument: any,
      startTime: number,
      midiNote: number,
      duration: number,
      velocity: number,
      bend?: number,
      filter?: any,
      attack?: number,
      release?: number
    ): void;
  }
}

// This empty export is necessary to treat this file as a module,
// which then allows the `declare global` block to work correctly.
export {};