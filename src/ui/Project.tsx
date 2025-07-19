import { FunctionComponent, useContext, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Transport } from './Transport';
import { Mixer } from './Mixer';
import { Duration, Location, Location as LocationValue } from '../core/Common';
import { Project as ProjectObj } from '../core/Project';
import {
  PlaybackPositionEvent,
  RegionEventType,
  TrackEventType,
  TransportEventType,
} from '../core/Events';
import { Arrangement } from './Arrangement';
import {
  BROWSER_WIDTH_INITIAL,
  BROWSER_WIDTH_MAX,
  BROWSER_WIDTH_MIN,
  TIMELINE_FACTOR_PX,
  TRACK_HEIGHT_PX,
} from './Config';
import { AudioTrack } from '../core/AudioTrack';
import { AbstractTrack } from '../core/Track';

import styles from './Project.module.css';
import { Browser } from './Browser';
import { EngineContext } from './Context';
import { AudioFile } from '../core/AudioFile';
import { AudioRegion } from '../core/AudioRegion';
import { cloneDeep } from 'lodash';
import { PianoRoll } from './PianoRoll';
import { MidiRegion } from '../core/MidiRegion';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';

export type ProjectProps = {
  project: ProjectObj;
  tracks: AbstractTrack[];
  setTracks: (tracks: AbstractTrack[]) => void;
  mixerVisible: boolean;
  setMixerVisible: (visible: boolean) => void;
  browserVisible: boolean;
  setBrowserVisible: (visible: boolean) => void;
  editingRegion: { trackIndex: number; regionIndex: number } | null;
  setEditingRegion: (region: { trackIndex: number; regionIndex: number } | null) => void;
  onRegionDoubleClick: (trackIndex: number, regionIndex: number) => void;
};

export const Project: FunctionComponent<ProjectProps> = (props) => {
  const engine = useContext(EngineContext)!;

  const [timelineScale, setTimelineScale] = useState(4);

  const [timestamp, setTimestamp] = useState(0);
  const [current, setCurrent] = useState(new LocationValue(1, 1, 1));

  const [loopStart, setLoopStart] = useState(props.project.loopStart);
  const [loopEnd, setLoopEnd] = useState(props.project.loopEnd);
  const [end, setEnd] = useState(props.project.end);

  const [looping, setLooping] = useState(engine.looping);

  function moveTrackToPosition(index: number, position: number) {
    props.project.moveTrackToPosition(index, position);
    props.setTracks([...props.project.tracks]);
  }

  function deleteTrack(index: number) {
    engine.handleTrackEvent({
      type: TrackEventType.Removed,
      track: props.project.tracks[index],
    });

    props.project.deleteTrack(index);
    props.setTracks([...props.project.tracks]);
  }

  function appendTrack(trackType: string) {
    if (trackType === 'audio') {
      const track = new AudioTrack();
      props.project.appendTrack(track);

      engine.handleTrackEvent({
        type: TrackEventType.Added,
        track: track,
      });

      props.setTracks([...props.project.tracks]);
    }
  }

  const changeLooping = (looping: boolean) => {
    setLooping(looping);
    engine.handleTransportEvent({
      type: TransportEventType.LoopingChanged,
      looping: looping,
    });
  };

  const changeTimestamp = (timestamp: number) => {
    const position = props.project.locationToTime.convertTime(timestamp);
    setCurrent(position);
    props.project.current = position;
    setTimestamp(timestamp);
    engine.handleTransportEvent({
      type: TransportEventType.PositionChanged,
      location: position,
    });
  };

  const changeCurrent = (location: LocationValue) => {
    const timestamp = props.project.locationToTime.convertLocation(location);
    setCurrent(location);
    props.project.current = location;
    setTimestamp(timestamp);
    engine.handleTransportEvent({
      type: TransportEventType.PositionChanged,
      location: location,
    });
  };

  const changeLoopStart = (location: LocationValue) => {
    setLoopStart(location);
    props.project.loopStart = location;
    engine.handleTransportEvent({
      type: TransportEventType.LoopStartLocatorChanged,
      location: location,
    });
  };

  const changeLoopEnd = (location: LocationValue) => {
    setLoopEnd(location);
    props.project.loopEnd = location;
    engine.handleTransportEvent({
      type: TransportEventType.LoopEndLocatorChanged,
      location: location,
    });
  };

  const changeEnd = (location: LocationValue) => {
    setEnd(location);
    props.project.end = location;
    engine.handleTransportEvent({
      type: TransportEventType.PlaybackEndLocatorChanged,
      location: location,
    });
  };

  const positionEventHandler = (event: PlaybackPositionEvent) => {
    setCurrent(event.location);
    setTimestamp(event.timestamp);
    props.project.current = event.location;
  };

  useEffect(() => {
    setLoopStart(props.project.loopStart);
    setLoopEnd(props.project.loopEnd);
    setEnd(props.project.end);
  }, [props.project]);

  useEffect(() => {
    engine.registerPlaybackPositionEventHandler(positionEventHandler);
    return () => {
      engine.unregisterPlaybackPositionEventHandler(positionEventHandler);
    };
  }, [engine]);

  const timelineRange = props.project.end.add(new Duration(1, 0, 0), props.project.timeSignature);
  const totalWidth =
    props.project.locationToTime.convertLocation(timelineRange) *
    timelineScale *
    TIMELINE_FACTOR_PX;

  const [browserWidth, setBrowserWidth] = useState(BROWSER_WIDTH_INITIAL);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const dragStartWidth = useRef(0);
  const dragTarget = useRef<HTMLElement | null>(null);

  function onBeginDragSeparator(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging && dragTarget.current === null) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragTarget.current = event.currentTarget;
      dragStart.current = event.clientX;
      dragStartWidth.current = browserWidth;
      setIsDragging(true);
    }
  }
  function onDragSeparator(event: React.PointerEvent<HTMLDivElement>) {
    if (isDragging) {
      const delta = event.clientX - dragStart.current;
      const newWidth = Math.min(
        Math.max(dragStartWidth.current + delta, BROWSER_WIDTH_MIN),
        BROWSER_WIDTH_MAX,
      );

      if (newWidth !== browserWidth) {
        setBrowserWidth(newWidth);
      }
    }
  }

  function onEndDragSeparator(event: React.PointerEvent<HTMLDivElement>) {
    if (isDragging) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      const delta = event.clientX - dragStart.current;
      const newWidth = Math.min(
        Math.max(dragStartWidth.current + delta, BROWSER_WIDTH_MIN),
        BROWSER_WIDTH_MAX,
      );

      if (newWidth !== browserWidth) {
        setBrowserWidth(newWidth);
      }

      dragTarget.current = null;
      setIsDragging(false);
    }
  }

  function createNewAudioTrackWithRegion(file: AudioFile, location: Location, duration: Duration) {
    const region = new AudioRegion(file, file.name, 'black', location, duration);
    const track = new AudioTrack([region], [], file.name);
    props.project.appendTrack(track);
    engine.handleTrackEvent({
      type: TrackEventType.Added,
      track: track,
    });
    props.setTracks([...props.project.tracks]);
  }

  function addRegionToTrack(
    file: AudioFile,
    trackIndex: number,
    location: Location,
    duration: Duration,
  ) {
    const region = new AudioRegion(file, file.name, 'black', location, duration);
    const track = props.project.tracks[trackIndex];

    if (track.type !== 'audio') {
      return;
    }

    const audioTrack = track as AudioTrack;
    audioTrack.addRegion(region, location, props.project.timeSignature);
    engine.handleRegionEvent({
      type: RegionEventType.Added,
      track: props.project.tracks[trackIndex],
      region: region,
    });
    props.setTracks(cloneDeep(props.project.tracks));
  }

  const updateTracksImmutable = (trackIndex: number, regionIndex: number, newRegion: MidiRegion) => {
    const newTracks = props.tracks.map((track, tIdx) => {
      if (tIdx !== trackIndex) return track;
      const newRegions = track.regions.map((region, rIdx) => {
        return rIdx === regionIndex ? newRegion : region;
      });
      const newTrack = cloneDeep(track);
      newTrack.regions = newRegions;
      return newTrack;
    });
    props.project.tracks = newTracks;
    props.setTracks(newTracks);
  };

  function handleMoveRegion(trackIndex: number, regionIndex: number, newPosition: Location) {
    const region = cloneDeep(props.tracks[trackIndex].regions[regionIndex]);
    region.position = newPosition;
    updateTracksImmutable(trackIndex, regionIndex, region as MidiRegion);
  }

  function handleResizeRegion(trackIndex: number, regionIndex: number, newLength: Duration) {
    const region = cloneDeep(props.tracks[trackIndex].regions[regionIndex]);
    region.length = newLength;
    updateTracksImmutable(trackIndex, regionIndex, region as MidiRegion);
  }

  const handleUpdateMidiRegion = (updatedRegion: MidiRegion) => {
    if (props.editingRegion) {
      const { trackIndex, regionIndex } = props.editingRegion;
      updateTracksImmutable(trackIndex, regionIndex, updatedRegion);
    }
  };

  return (
    <div className="flex flex-col flex-grow overflow-hidden bg-background text-foreground">
      <Transport
        project={props.project}
        totalWidth={totalWidth}
        timelineScale={timelineScale}
        setTimelineScale={setTimelineScale}
        timestamp={timestamp}
        setTimestamp={changeTimestamp}
        current={current}
        setCurrent={changeCurrent}
        loopStart={loopStart}
        setLoopStart={changeLoopStart}
        loopEnd={loopEnd}
        setLoopEnd={changeLoopEnd}
        end={end}
        setEnd={changeEnd}
        looping={looping}
        setLooping={changeLooping}
      />
      <div className="flex-grow flex flex-col overflow-hidden">
        <div className={styles.center}>
          {props.browserVisible ? (
            <>
              <div
                className={styles.browser}
                style={{
                  width: `${browserWidth}px`,
                  minWidth: `${browserWidth}px`,
                  maxWidth: `${browserWidth}px`,
                }}
              >
                <div className="p-2 border-b flex justify-between items-center">
                  <h2 className="font-semibold">Library</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => props.setBrowserVisible(false)}
                  >
                    <ChevronLeft />
                  </Button>
                </div>
                <div className={styles.browserInner}>
                  <Browser
                    tracks={props.tracks}
                    totalWidth={totalWidth}
                    totalHeight={(props.tracks.length + 1) * TRACK_HEIGHT_PX}
                    scale={timelineScale}
                    timeSignature={props.project.timeSignature}
                    converter={props.project.locationToTime}
                    end={end}
                    createNewAudioTrackWithRegion={createNewAudioTrackWithRegion}
                    addRegionToTrack={addRegionToTrack}
                  />
                </div>
              </div>
              <div
                className={styles.separator}
                onPointerDown={onBeginDragSeparator}
                onPointerMove={onDragSeparator}
                onPointerUp={onEndDragSeparator}
              />
            </>
          ) : (
            <div className="flex items-center justify-center p-1 border-r bg-muted">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.setBrowserVisible(true)}
                className="[writing-mode:vertical-lr] text-muted-foreground"
              >
                <ChevronRight className="inline rotate-90 mb-2" /> Library
              </Button>
            </div>
          )}
          <Arrangement
            tracks={props.tracks}
            updateTrackEnablement={() => props.project.updateTrackEnablement()}
            appendTrack={appendTrack}
            moveTrackToPosition={moveTrackToPosition}
            deleteTrack={deleteTrack}
            totalWidth={totalWidth}
            totalHeight={(props.tracks.length + 1) * TRACK_HEIGHT_PX}
            scale={timelineScale}
            timeSignature={props.project.timeSignature}
            converter={props.project.locationToTime}
            timestamp={timestamp}
            setTimestamp={changeTimestamp}
            current={current}
            setCurrent={changeCurrent}
            loopStart={loopStart}
            setLoopStart={changeLoopStart}
            loopEnd={loopEnd}
            setLoopEnd={changeLoopEnd}
            end={end}
            setEnd={changeEnd}
            looping={looping}
            setLooping={changeLooping}
            onMoveRegion={handleMoveRegion}
            onResizeRegion={handleResizeRegion}
            onRegionDoubleClick={props.onRegionDoubleClick}
          />
        </div>
        {props.editingRegion && (
          <div className={styles.editorPane}>
            <PianoRoll
              region={
                props.project.tracks[props.editingRegion.trackIndex].regions[
                  props.editingRegion.regionIndex
                ] as MidiRegion
              }
              timeSignature={props.project.timeSignature}
              converter={props.project.locationToTime}
              scale={timelineScale}
              end={end}
              onUpdateRegion={handleUpdateMidiRegion}
            />
          </div>
        )}
      </div>
      <Sheet open={props.mixerVisible} onOpenChange={props.setMixerVisible}>
        <SheetContent side="bottom" className="h-3/4">
          <SheetHeader>
            <SheetTitle>Mixer</SheetTitle>
            <SheetDescription>Adjust track volumes, panning, and effects.</SheetDescription>
          </SheetHeader>
          <Mixer />
        </SheetContent>
      </Sheet>
    </div>
  );
};