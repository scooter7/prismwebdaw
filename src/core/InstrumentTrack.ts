// src/core/InstrumentTrack.ts  (or wherever this lives)

import { AudioEffect } from './AudioEffect';
import { AudioFileResolver } from './AudioFile';
import {
  JSONObject,
  JSONValue,
  Location,
  LocationToTime,
  assert,
  Duration,
  TimeSignature,
} from './Common';
import { Instrument } from './Instrument';
import { MidiDataType, NoteMidiData } from './MidiData';
import { MidiEffect } from './MidiEffect';
import { MidiRegion } from './MidiRegion';
import { AbstractTrack } from './Track';

type AudioState = {
  channelStripInput: GainNode;
  panner: StereoPannerNode;
  gain: GainNode;
};

/**
 * A minimal no-op fallback instrument used when deserializing without a real instrument.
 * **Replace this** with your real instrument resolution logic (e.g., lookup by name or type).
 */
const createFallbackInstrument = (): Instrument =>
  ({
    // @ts-ignore stub implementations; shape assumed based on usage
    initialize: async (_context: AudioContext) => {},
    connect: (_node: AudioNode) => {},
    disconnect: () => {},
    noteOn: (_note: number, _velocity: number, _time: number) => {},
    noteOff: (_note: number, _time: number) => {},
    stopAll: () => {},
  } as unknown as Instrument);

/**
 * An InstrumentTrack is a track that contains MIDI regions, which represent fragments of MIDI
 * that are to be rendered as audio by a built-in instrument or audio module.
 */
export class InstrumentTrack extends AbstractTrack {
  regions: MidiRegion[] = [];
  midiEffects: MidiEffect[] = [];
  instrument: Instrument;
  audioEffects: AudioEffect[] = [];
  audioState: AudioState | null = null;

  private _volume: number = 0;
  private _pan: number = 0;
  private _enabled: boolean = true;
  private _scheduleContinuation: boolean = false;

  set volume(value: number) {
    if (value === undefined) return;
    this._volume = value;
    if (this.audioState !== null) {
      this.audioState.gain.gain.value = this.gainFromVolume;
    }
  }

  get volume(): number {
    return this._volume;
  }

  set pan(value: number) {
    if (value === undefined) return;
    this._pan = value;
    if (this.audioState !== null) {
      this.audioState.panner.pan.value = value;
    }
  }

  get pan(): number {
    return this._pan;
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(value: boolean) {
    if (value === undefined || value === this._enabled) return;
    this._enabled = value;
    if (this.audioState !== null) {
      this.audioState.channelStripInput.gain.value = value ? 1 : 0;
      if (!value) {
        this.stop();
      }
    }
    if (value) {
      this._scheduleContinuation = true;
    }
  }

  constructor(name: string, color: string, muted: boolean, instrument: Instrument) {
    super(name, color, muted);
    this.instrument = instrument;
    this.enabled = !muted;
  }

  async initializeAudio(context: AudioContext): Promise<void> {
    if (this.audioState === null) {
      const channelStripInput = context.createGain();
      const gain = context.createGain();
      const panner = context.createStereoPanner();

      if (typeof this.instrument.initialize === 'function') {
        await this.instrument.initialize(context);
      } else {
        console.warn('Instrument missing initialize(), continuing with fallback behavior.');
      }

      if (typeof this.instrument.connect === 'function') {
        this.instrument.connect(channelStripInput);
      }

      channelStripInput.connect(panner);
      panner.connect(gain);
      gain.connect(context.destination);

      channelStripInput.gain.value = this._enabled ? 1 : 0;
      panner.pan.value = this.pan;
      gain.gain.value = this.gainFromVolume;

      this.audioState = { channelStripInput, gain, panner };
    } else {
      assert(
        this.audioState.gain.context === context,
        'Audio nodes already initialized with a different audio context'
      );
    }
  }

  deinitializeAudio(): void {
    if (this.audioState !== null) {
      if (typeof this.instrument.disconnect === 'function') {
        this.instrument.disconnect();
      }
      this.audioState.gain.disconnect();
      this.audioState.panner.disconnect();
      this.audioState.channelStripInput.disconnect();
      this.audioState = null;
    } else {
      throw new Error('Audio nodes not initialized');
    }
  }

  isAudioInitialized(): boolean {
    return this.audioState !== null;
  }

  // JSON serialization/deserialization support
  public static TYPE_TAG = 'instrument';

  get type(): string {
    return InstrumentTrack.TYPE_TAG;
  }

  static fromJson(file: JSONValue, resolver: AudioFileResolver): InstrumentTrack {
    if (typeof file !== 'object' || file === null) {
      throw new Error('Invalid JSON value for InstrumentTrack');
    }

    const obj = file as JSONObject;

    // Example: if your JSON includes an "instrument" field (e.g., a name or type), resolve it here.
    // Fallback to a no-op instrument so we don't crash.
    let instrument: Instrument;
    if (typeof obj['instrument'] === 'string') {
      // Replace this with your real resolution logic, e.g.:
      // instrument = resolver.getInstrumentByName(obj['instrument'] as string);
      instrument = createFallbackInstrument();
    } else {
      instrument = createFallbackInstrument();
    }

    return new InstrumentTrack(
      obj['name'] as string,
      obj['color'] as string,
      obj['muted'] as boolean,
      instrument
    );
  }

  static registerFactory() {
    AbstractTrack.registerFactory(InstrumentTrack.TYPE_TAG, InstrumentTrack.fromJson);
  }

  public splitRegion(
    regionIndex: number,
    splitLocation: Location,
    timeSignature: TimeSignature,
    converter: LocationToTime
  ): void {
    const originalRegion = this.regions[regionIndex];
    if (!originalRegion) return;

    const firstPartDuration = originalRegion.position.diff(splitLocation, timeSignature);
    const originalRegionEnd = originalRegion.position.add(originalRegion.length, timeSignature);
    const secondPartDuration = splitLocation.diff(originalRegionEnd, timeSignature);

    if (
      firstPartDuration.compare(new Duration(0, 0, 0)) <= 0 ||
      secondPartDuration.compare(new Duration(0, 0, 0)) <= 0
    ) {
      console.warn('Split location is at or outside region boundaries. No split performed.');
      return;
    }

    const firstPartMidiData = originalRegion.midiData.filter((midiEvent) => {
      return midiEvent.start.compare(splitLocation) < 0;
    });

    const secondPartMidiData = originalRegion.midiData.filter((midiEvent) => {
      return midiEvent.start.compare(splitLocation) >= 0;
    });

    const firstRegion = new MidiRegion(
      firstPartMidiData,
      originalRegion.name,
      originalRegion.color,
      originalRegion.position,
      firstPartDuration,
      firstPartDuration,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation
    );

    const secondRegion = new MidiRegion(
      secondPartMidiData,
      originalRegion.name,
      originalRegion.color,
      splitLocation,
      secondPartDuration,
      secondPartDuration,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation
    );

    this.regions.splice(regionIndex, 1, firstRegion, secondRegion);
    this.regions.sort((a, b) => a.position.compare(b.position));
  }

  public duplicateRegion(
    regionIndex: number,
    targetLocation: Location,
    timeSignature: TimeSignature,
    converter: LocationToTime
  ): void {
    const originalRegion = this.regions[regionIndex];
    if (!originalRegion) return;

    const duplicatedRegion = new MidiRegion(
      originalRegion.midiData,
      originalRegion.name,
      originalRegion.color,
      targetLocation,
      originalRegion.size,
      originalRegion.length,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation
    );

    this.regions.push(duplicatedRegion);
    this.regions.sort((a, b) => a.position.compare(b.position));
  }

  public deleteRegion(regionIndex: number): void {
    this.regions.splice(regionIndex, 1);
  }

  scheduleAudioEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number,
    discontinuationTime?: number
  ): void {
    // InstrumentTrack schedules via MIDI events, so nothing here.
  }

  scheduleMidiEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number,
    discontinuationTime?: number
  ): void {
    if (!this.enabled || !this.isAudioInitialized()) return;

    this.regions.forEach((region) => {
      region.midiData.forEach((midiEvent) => {
        if (midiEvent.type === MidiDataType.Note) {
          const note = midiEvent as NoteMidiData;
          const noteStartTime = converter.convertLocation(note.start);
          const timeSignature = converter.timeSignatureAtLocation(note.start);
          const noteEndTime = converter.convertLocation(
            note.start.add(note.duration, timeSignature)
          );

          if (noteStartTime >= startTime && noteStartTime < endTime) {
            if (typeof this.instrument.noteOn === 'function') {
              this.instrument.noteOn(note.note, note.velocity, timeOffset + noteStartTime);
            }
            if (typeof this.instrument.noteOff === 'function') {
              this.instrument.noteOff(note.note, timeOffset + noteEndTime);
            }
          }
        }
      });
    });
  }

  adjustDiscontinuationTime(
    timeOffset: number,
    oldDiscontinuationTime: number,
    newDiscontinuationTime: number,
    converter: LocationToTime,
    loopIteration: number
  ): void {}

  housekeeping(currentTime: number): void {}

  stop(): void {
    if (typeof this.instrument.stopAll === 'function') {
      this.instrument.stopAll();
    }
  }
}
