import { Midi } from '@tonejs/midi';
import { InstrumentTrack } from '../core/InstrumentTrack';
import { MidiRegion } from '../core/MidiRegion';
import { NoteMidiData, MidiDataType } from '../core/MidiData';
import { Analog } from '../instruments/Analog';
import { Project } from '../core/Project';

export async function parseMidiFile(file: File, project: Project): Promise<InstrumentTrack[]> {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const newTracks: InstrumentTrack[] = [];
  const converter = project.locationToTime;
  const timeSignature = project.timeSignature;

  midi.tracks.forEach((track, trackIndex) => {
    if (track.notes.length === 0) {
      return;
    }

    const notes: NoteMidiData[] = track.notes.map((note) => {
      const startLocation = converter.convertTime(note.time);
      const endLocation = converter.convertTime(note.time + note.duration);
      const duration = startLocation.diff(endLocation, timeSignature);

      return {
        type: MidiDataType.Note,
        start: startLocation,
        duration: duration,
        note: note.midi,
        velocity: Math.round(note.velocity * 127), // Tone.js velocity is 0-1
      };
    });

    const trackName = track.name || `MIDI Track ${trackIndex + 1}`;

    const firstNoteStart = notes.reduce((min, p) => (p.start.compare(min.start) < 0 ? p : min))
      .start;
    const lastNoteEnd = notes.reduce((max, p) => {
      const end = p.start.add(p.duration, timeSignature);
      const maxEnd = max.start.add(max.duration, timeSignature);
      return end.compare(maxEnd) > 0 ? p : max;
    });
    const lastNoteEndLocation = lastNoteEnd.start.add(lastNoteEnd.duration, timeSignature);
    const regionDuration = firstNoteStart.diff(lastNoteEndLocation, timeSignature);

    const region = new MidiRegion(notes, trackName, '#39f', firstNoteStart, regionDuration);

    const instrument = new Analog();
    const newTrack = new InstrumentTrack(trackName, '#39f', false, instrument);
    newTrack.regions.push(region);
    newTracks.push(newTrack);
  });

  return newTracks;
}