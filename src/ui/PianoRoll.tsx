import { FunctionComponent, useState, useRef } from 'react';
import { MidiRegion } from '../core/MidiRegion';
import { LocationToTime, TimeSignature, Location, Duration } from '../core/Common';
import { MidiDataType, NoteMidiData } from '../core/MidiData';
import { TIMELINE_FACTOR_PX } from './Config';
import styles from './PianoRoll.module.css';
import { TimelineGenerator, TimelineSettings } from './Timeline';
import { cloneDeep } from 'lodash';

export interface PianoRollProps {
  region: MidiRegion;
  timeSignature: TimeSignature;
  converter: LocationToTime;
  scale: number;
  end: Location;
  onUpdateRegion: (region: MidiRegion) => void;
}

const NOTE_HEIGHT = 20; // px
const notes = Array.from({ length: 128 }, (_, i) => 127 - i); // MIDI notes from 127 down to 0
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isBlackKey = (note: number) => {
  const key = note % 12;
  return key === 1 || key === 3 || key === 6 || key === 8 || key === 10;
};

enum DragType {
  None,
  Move,
  ResizeLeft,
  ResizeRight,
}

interface DragState {
  type: DragType;
  noteIndex: number;
  startX: number;
  startY: number;
  originalNote: NoteMidiData | null;
  tempLeft?: number;
  tempTop?: number;
  tempWidth?: number;
}

export const PianoRoll: FunctionComponent<PianoRollProps> = (props) => {
  const scaleFactor = props.scale * TIMELINE_FACTOR_PX;
  const regionStartTime = props.converter.convertLocation(props.region.position);
  const regionDuration = props.converter.convertDurationAtLocation(
    props.region.length,
    props.region.position,
  );
  const gridWidth = regionDuration * scaleFactor;
  const gridHeight = notes.length * NOTE_HEIGHT;

  const settings = new TimelineSettings(props.scale);
  const tickIterator = new TimelineGenerator(
    props.region.position,
    props.region.position.add(props.region.length, props.timeSignature),
    settings.minorStep,
    props.timeSignature,
  );

  const [dragState, setDragState] = useState<DragState>({
    type: DragType.None,
    noteIndex: -1,
    startX: 0,
    startY: 0,
    originalNote: null,
  });

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    noteIndex: number,
    type: DragType,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const originalNote = props.region.midiData[noteIndex] as NoteMidiData;
    setDragState({
      type,
      noteIndex,
      startX: e.clientX,
      startY: e.clientY,
      originalNote,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type === DragType.None || !dragState.originalNote) return;
    e.stopPropagation();

    const deltaX = e.clientX - dragState.startX;
    const originalNoteStart = props.converter.convertLocation(dragState.originalNote.start);
    const originalNoteDuration = props.converter.convertDurationAtLocation(
      dragState.originalNote.duration,
      dragState.originalNote.start,
    );
    const originalNoteLeft = (originalNoteStart - regionStartTime) * scaleFactor;
    const originalNoteWidth = originalNoteDuration * scaleFactor;

    switch (dragState.type) {
      case DragType.Move: {
        const deltaY = e.clientY - dragState.startY;
        const originalNoteTop = (127 - dragState.originalNote.note) * NOTE_HEIGHT;
        setDragState((prev) => ({
          ...prev,
          tempTop: originalNoteTop + deltaY,
          tempLeft: originalNoteLeft + deltaX,
        }));
        break;
      }
      case DragType.ResizeRight: {
        const newWidth = Math.max(1, originalNoteWidth + deltaX);
        setDragState((prev) => ({ ...prev, tempWidth: newWidth }));
        break;
      }
      case DragType.ResizeLeft: {
        const newLeft = Math.min(
          originalNoteLeft + originalNoteWidth - 1,
          originalNoteLeft + deltaX,
        );
        const newWidth = originalNoteLeft + originalNoteWidth - newLeft;
        setDragState((prev) => ({ ...prev, tempLeft: newLeft, tempWidth: newWidth }));
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type === DragType.None || !dragState.originalNote) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);

    const newRegion = cloneDeep(props.region);
    const updatedNote = newRegion.midiData[dragState.noteIndex] as NoteMidiData;
    const deltaX = e.clientX - dragState.startX;

    switch (dragState.type) {
      case DragType.Move: {
        const deltaY = e.clientY - dragState.startY;
        const pitchChange = -Math.round(deltaY / NOTE_HEIGHT);
        updatedNote.note = Math.max(0, Math.min(127, dragState.originalNote.note + pitchChange));

        const timeChange = deltaX / scaleFactor;
        const originalNoteTime = props.converter.convertLocation(dragState.originalNote.start);
        const newNoteTime = originalNoteTime + timeChange;
        updatedNote.start = settings.snap(
          newNoteTime,
          props.end,
          props.timeSignature,
          props.converter,
        );
        break;
      }
      case DragType.ResizeRight: {
        const originalNoteDuration = props.converter.convertDurationAtLocation(
          dragState.originalNote.duration,
          dragState.originalNote.start,
        );
        const originalNoteWidth = originalNoteDuration * scaleFactor;
        const newWidth = Math.max(1, originalNoteWidth + deltaX);
        const newDurationSeconds = newWidth / scaleFactor;
        const noteStartTime = props.converter.convertLocation(updatedNote.start);
        const newEndTime = noteStartTime + newDurationSeconds;
        const snappedEndLocation = settings.snap(
          newEndTime,
          props.end,
          props.timeSignature,
          props.converter,
        );
        updatedNote.duration = updatedNote.start.diff(snappedEndLocation, props.timeSignature);
        break;
      }
      case DragType.ResizeLeft: {
        const originalNoteStart = props.converter.convertLocation(dragState.originalNote.start);
        const originalNoteEnd =
          originalNoteStart +
          props.converter.convertDurationAtLocation(
            dragState.originalNote.duration,
            dragState.originalNote.start,
          );

        const timeChange = deltaX / scaleFactor;
        const newStartTime = originalNoteStart + timeChange;
        const snappedStartLocation = settings.snap(
          newStartTime,
          props.end,
          props.timeSignature,
          props.converter,
        );
        const snappedStartTime = props.converter.convertLocation(snappedStartLocation);

        if (snappedStartTime < originalNoteEnd) {
          updatedNote.start = snappedStartLocation;
          const endLocation = props.converter.convertTime(originalNoteEnd);
          updatedNote.duration = snappedStartLocation.diff(endLocation, props.timeSignature);
        }
        break;
      }
    }

    props.onUpdateRegion(newRegion);
    setDragState({ type: DragType.None, noteIndex: -1, startX: 0, startY: 0, originalNote: null });
  };

  return (
    <div className={styles.pianoRoll} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className={styles.keyboard}>
        {notes.map((note) => (
          <div
            key={note}
            className={`${styles.key} ${isBlackKey(note) ? styles.blackKey : styles.whiteKey}`}
            style={{ height: NOTE_HEIGHT }}
          >
            {noteNames[note % 12]}
            {Math.floor(note / 12) - 1}
          </div>
        ))}
      </div>
      <div className={styles.gridContainer}>
        <div className={styles.grid} style={{ width: gridWidth, height: gridHeight }}>
          {Array.from(tickIterator).map((location: Location) => {
            const time = props.converter.convertLocation(location) - regionStartTime;
            if (time < 0) return null;
            return (
              <div
                key={`v-line-${location.bar}-${location.beat}-${location.tick}`}
                className={styles.gridLineVertical}
                style={{ left: time * scaleFactor, height: gridHeight }}
              />
            );
          })}
          {notes.map((note, index) => (
            <div
              key={`h-line-${note}`}
              className={
                isBlackKey(note) ? styles.gridLineHorizontalDark : styles.gridLineHorizontal
              }
              style={{ top: index * NOTE_HEIGHT, width: gridWidth }}
            />
          ))}
          {props.region.midiData.map((noteData, index) => {
            if (noteData.type !== MidiDataType.Note) return null;

            const note = noteData as NoteMidiData;
            const noteStartTime = props.converter.convertLocation(note.start);
            const relativeNoteStartTime = noteStartTime - regionStartTime;
            const noteDuration = props.converter.convertDurationAtLocation(
              note.duration,
              note.start,
            );

            const isDraggingThisNote = dragState.type !== DragType.None && dragState.noteIndex === index;
            const left = (relativeNoteStartTime * scaleFactor);
            const width = (noteDuration * scaleFactor);

            const noteStyle = {
              top: isDraggingThisNote && dragState.tempTop !== undefined ? `${dragState.tempTop}px` : `${(127 - note.note) * NOTE_HEIGHT}px`,
              left: isDraggingThisNote && dragState.tempLeft !== undefined ? `${dragState.tempLeft}px` : `${left}px`,
              width: isDraggingThisNote && dragState.tempWidth !== undefined ? `${dragState.tempWidth}px` : `${width}px`,
              height: `${NOTE_HEIGHT - 2}px`,
              zIndex: isDraggingThisNote ? 10 : 2,
            };

            return (
              <div key={index} className={styles.note} style={noteStyle}>
                <div
                  className={styles.handleLeft}
                  onPointerDown={(e) => onPointerDown(e, index, DragType.ResizeLeft)}
                />
                <div
                  className={styles.handleMove}
                  onPointerDown={(e) => onPointerDown(e, index, DragType.Move)}
                />
                <div
                  className={styles.handleRight}
                  onPointerDown={(e) => onPointerDown(e, index, DragType.ResizeRight)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};