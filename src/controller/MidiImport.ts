import { parseMidi, MidiEvent } from 'midi-file';
import { InstrumentTrack } from '../core/InstrumentTrack';
import { MidiRegion } from '../core/MidiRegion';
import { NoteMidiData, MidiDataType } from '../core/MidiData';
import { Location, Duration, TimeSignature } from '../core/Common';
import { Analog } from '../instruments/Analog';

function ticksToLocation(absoluteMidiTicks: number, midiTicksPerBeat: number, timeSignature: TimeSignature): Location {
    const beats = absoluteMidiTicks / midiTicksPerBeat;
    const bars = Math.floor(beats / timeSignature.beatsPerBar);
    const remainingBeats = Math.floor(beats) % timeSignature.beatsPerBar;
    const remainingTicksInBeat = (beats - Math.floor(beats)) * timeSignature.ticksPerBeat;
    
    return new Location(bars + 1, remainingBeats + 1, Math.round(remainingTicksInBeat) + 1);
}

export async function parseMidiFile(file: File, timeSignature: TimeSignature): Promise<InstrumentTrack[]> {
    const arrayBuffer = await file.arrayBuffer();
    const parsedMidi = parseMidi(arrayBuffer);

    const ticksPerBeat = parsedMidi.header.ticksPerBeat;
    if (!ticksPerBeat) {
        throw new Error('MIDI file does not specify ticksPerBeat (PPQN).');
    }

    const newTracks: InstrumentTrack[] = [];

    parsedMidi.tracks.forEach((track, trackIndex) => {
        const notes: NoteMidiData[] = [];
        const openNotes: { [key: string]: { start: number; velocity: number } } = {};
        let absoluteTicks = 0;

        track.forEach((event: MidiEvent) => {
            absoluteTicks += event.deltaTime;

            if (event.type === 'noteOn' && event.velocity > 0) {
                const key = `${event.channel}-${event.noteNumber}`;
                openNotes[key] = { start: absoluteTicks, velocity: event.velocity };
            } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                const key = `${event.channel}-${event.noteNumber}`;
                const openNote = openNotes[key];
                if (openNote) {
                    const startLocation = ticksToLocation(openNote.start, ticksPerBeat, timeSignature);
                    const endLocation = ticksToLocation(absoluteTicks, ticksPerBeat, timeSignature);
                    const duration = startLocation.diff(endLocation, timeSignature);

                    notes.push({
                        type: MidiDataType.Note,
                        start: startLocation,
                        duration: duration,
                        note: event.noteNumber,
                        velocity: openNote.velocity,
                    });
                    delete openNotes[key];
                }
            }
        });

        if (notes.length > 0) {
            const trackName = `MIDI Track ${trackIndex + 1}`;
            
            const firstNoteStart = notes.reduce((min, p) => p.start.compare(min.start) < 0 ? p : min).start;
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
        }
    });

    return newTracks;
}