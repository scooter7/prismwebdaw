import { Icon, Tree, TreeNodeInfo, Spinner } from '@blueprintjs/core';
import {
  FunctionComponent,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Duration,
  Location,
  LocationToTime,
  TimeSignature,
} from '../core/Common';
import {
  CLICK_TO_DRAG_TIMEOUT_MS,
  LIBRARY_JSON,
  REGION_PLACEHOLDER_ID,
  REGION_SCROLL_VIEW_ID,
  TIMELINE_FACTOR_PX,
  TRACK_HEIGHT_PX,
} from './Config';
import { clone, cloneDeep } from 'lodash';

import styles from './Browser.module.css';
import { AudioFile } from '../core/AudioFile';
import { AudioContextContext } from './Context';
import { TrackInterface } from '../core/Track';
import { TimelineSettings } from './Timeline';

export type NodePath = number[];

type NodeData = {
  audioFile?: AudioFile;
  isMidi?: boolean;
  isLoading?: boolean;
} | null;

function canDrag(node: TreeNodeInfo<NodeData>) {
  if (node.nodeData?.isMidi) {
    return true; // MIDI files are always draggable
  }
  return node.nodeData?.audioFile?.ready && !node.nodeData.isLoading;
}

export type BrowserProps = {
  scale: number;
  timeSignature: TimeSignature;
  converter: LocationToTime;
  end: Location;

  totalWidth: number;
  totalHeight: number;

  tracks: TrackInterface[];
  createNewAudioTrackWithRegion: (
    region: AudioFile,
    location: Location,
    duration: Duration,
  ) => void;
  addRegionToTrack: (
    region: AudioFile,
    trackIndex: number,
    location: Location,
    duration: Duration,
  ) => void;
  createNewTracksFromMidi: (url: string) => void;
};

export const Browser: FunctionComponent<BrowserProps> = (props: BrowserProps) => {
  const audioContext = useContext(AudioContextContext)!;

  const INITIAL_STATE: TreeNodeInfo<NodeData>[] = [];

  type TreeAction =
    | { type: 'SET_IS_EXPANDED'; payload: { path: NodePath; isExpanded: boolean } }
    | { type: 'DESELECT_ALL' }
    | { type: 'SET_IS_SELECTED'; payload: { path: NodePath; isSelected: boolean } }
    | { type: 'RELOAD_TREE_NODES'; payload: { nodes: TreeNodeInfo<NodeData>[] } }
    | { type: 'START_LOAD'; payload: { path: NodePath } }
    | { type: 'FINISH_LOAD'; payload: { path: NodePath; success: boolean } };

  function forEachNode(
    nodes: TreeNodeInfo<NodeData>[] | undefined,
    callback: (node: TreeNodeInfo<NodeData>) => void,
  ) {
    if (nodes === undefined) {
      return;
    }

    for (const node of nodes) {
      callback(node);
      forEachNode(node.childNodes, callback);
    }
  }

  function forNodeAtPath(
    nodes: TreeNodeInfo<NodeData>[],
    path: NodePath,
    callback: (node: TreeNodeInfo<NodeData>) => void,
  ) {
    callback(Tree.nodeFromPath(path, nodes));
  }

  function treeReducer(state: TreeNodeInfo<NodeData>[], action: TreeAction) {
    const newState = cloneDeep(state);
    switch (action.type) {
      case 'DESELECT_ALL':
        forEachNode(newState, (node) => (node.isSelected = false));
        return newState;

      case 'SET_IS_EXPANDED':
        forNodeAtPath(
          newState,
          action.payload.path,
          (node) => (node.isExpanded = action.payload.isExpanded),
        );
        return newState;

      case 'SET_IS_SELECTED':
        forNodeAtPath(
          newState,
          action.payload.path,
          (node) => (node.isSelected = action.payload.isSelected),
        );
        return newState;

      case 'RELOAD_TREE_NODES':
        return action.payload.nodes;

      case 'START_LOAD':
        forNodeAtPath(newState, action.payload.path, (node) => {
          if (!node.nodeData) node.nodeData = {};
          node.nodeData.isLoading = true;
          node.icon = <Spinner size={16} />;
          const audioFile = AudioFile.create(new URL(node.id as string));
          node.nodeData.audioFile = audioFile;
          audioFile.load(
            audioContext,
            () => {
              dispatch({ type: 'FINISH_LOAD', payload: { path: action.payload.path, success: true } });
            },
            () => {
              dispatch({ type: 'FINISH_LOAD', payload: { path: action.payload.path, success: false } });
            },
          );
        });
        return newState;

      case 'FINISH_LOAD':
        forNodeAtPath(newState, action.payload.path, (node) => {
          if (!node.nodeData) node.nodeData = {};
          node.nodeData.isLoading = false;
          if (action.payload.success) {
            node.icon = 'music';
          } else {
            node.icon = 'error';
          }
        });
        return newState;

      default:
        return state;
    }
  }

  const [nodes, dispatch] = useReducer(treeReducer, INITIAL_STATE);

  function jsonToTreeNodes(json: any): TreeNodeInfo<NodeData> {
    if (!json) {
      console.error('jsonToTreeNodes called with null or undefined json');
      return {
        id: 'error',
        label: 'Error: Invalid data',
        isExpanded: false,
        icon: 'error',
        nodeData: null,
      };
    }
    
    // Check if this is an error node we created
    if (json.id === 'error') {
      return json;
    }
    
    if (json.children) {
      return {
        id: json.path,
        label: json.name,
        isExpanded: false,
        childNodes: json.children.map((child: any) => jsonToTreeNodes(child)),
        icon: 'folder-close',
        nodeData: null,
      };
    } else {
      const isMidi = json.name && (json.name.endsWith('.mid') || json.name.endsWith('.midi'));
      try {
        const nodeId = new URL(json.path, document.baseURI).toString();
        return {
          id: nodeId,
          label: json.name,
          isExpanded: false,
          icon: isMidi ? 'document' : 'music',
          nodeData: { isMidi },
        };
      } catch (e: any) {
        console.error('Error creating URL for path:', json.path, e);
        return {
          id: 'error-' + json.path,
          label: 'Error: ' + json.name,
          isExpanded: false,
          icon: 'error',
          nodeData: null,
        };
      }
    }
  }

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        // Try multiple approaches to fetch the library.json file
        let response;
        let text;
        let json;
        
        // First try with the current approach
        const urlString = new URL(LIBRARY_JSON, document.baseURI).toString();
        console.log('Fetching library from:', urlString);
        
        response = await fetch(urlString);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        text = await response.text();
        console.log('Response text (first 200 chars):', text.substring(0, 200));
        
        // Check if the response starts with a DOCTYPE (which would indicate HTML instead of JSON)
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<!DOCTYPE')) {
          // Try with an absolute path approach
          console.log('Received HTML, trying absolute path approach');
          const absoluteUrl = `${window.location.origin}/${LIBRARY_JSON}`;
          console.log('Fetching library from absolute URL:', absoluteUrl);
          
          response = await fetch(absoluteUrl);
          console.log('Absolute URL response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          text = await response.text();
          console.log('Absolute URL response text (first 200 chars):', text.substring(0, 200));
          
          // Check again if it's HTML
          if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<!DOCTYPE')) {
            throw new Error('Received HTML instead of JSON - check if the file is being served correctly');
          }
        }
        
        json = JSON.parse(text);
        console.log('Successfully parsed JSON, creating tree nodes');
        dispatch({ type: 'RELOAD_TREE_NODES', payload: { nodes: [jsonToTreeNodes(json)] } });
      } catch (error) {
        console.error('Failed to fetch or parse library.json:', error);
        // Show an error message to the user
        dispatch({ 
          type: 'RELOAD_TREE_NODES', 
          payload: { 
            nodes: [{
              id: 'error',
              label: 'Error loading library',
              isExpanded: false,
              icon: 'error',
              nodeData: null,
            }] 
          } 
        });
      }
    };
    
    fetchLibrary();
  }, []);

  const handleNodeClick = useCallback(
    (node: TreeNodeInfo<NodeData>, nodePath: NodePath, e: React.MouseEvent<HTMLElement>) => {
      const originallySelected = node.isSelected;
      if (!e.shiftKey) {
        dispatch({ type: 'DESELECT_ALL' });
      }
      dispatch({
        payload: {
          path: nodePath,
          isSelected: originallySelected == null ? true : !originallySelected,
        },
        type: 'SET_IS_SELECTED',
      });

      if (
        !node.nodeData?.isMidi &&
        node.childNodes === undefined &&
        node.nodeData &&
        !node.nodeData.audioFile &&
        !node.nodeData.isLoading
      ) {
        dispatch({ type: 'START_LOAD', payload: { path: nodePath } });
      }
    },
    [],
  );

  const handleNodeCollapse = useCallback((_node: TreeNodeInfo<NodeData>, nodePath: NodePath) => {
    dispatch({
      payload: { path: nodePath, isExpanded: false },
      type: 'SET_IS_EXPANDED',
    });
  }, []);

  const handleNodeExpand = useCallback((_node: TreeNodeInfo<NodeData>, nodePath: NodePath) => {
    dispatch({
      payload: { path: nodePath, isExpanded: true },
      type: 'SET_IS_EXPANDED',
    });
  }, []);

  const BROWSER_DRAG_DIV_ID = 'browser-drag-div';
  const tree = useRef<Tree<NodeData>>(null);
  const dragLabel = useRef<HTMLDivElement>(null);
  const dragLabelText = useRef('');
  const currentTreeNode = useRef<TreeNodeInfo<NodeData> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragTarget = useRef<Element | null>(null);
  const startDragTimeout = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (
      !isDragging &&
      dragTarget.current === null &&
      currentTreeNode.current !== null &&
      canDrag(currentTreeNode.current)
    ) {
      startDragTimeout.current = window.setTimeout(() => {
        onStartDrag(e);
      }, CLICK_TO_DRAG_TIMEOUT_MS);
    }
  }

  function onStartDrag(e: React.PointerEvent<HTMLDivElement>) {
    startDragTimeout.current = null;
    setIsDragging(true);
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragTarget.current = e.target as Element;
    dragTarget.current.setPointerCapture(e.pointerId);
    dragLabel.current!.style.display = 'block';
    dragLabel.current!.style.left = `${e.clientX}px`;
    dragLabel.current!.style.top = `${e.clientY}px`;
    const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);

    if (currentTreeNode.current?.nodeData?.isMidi) {
      regionPlaceholder!.style.width = `120px`; // Default width for MIDI
    } else {
      const audioFile = currentTreeNode.current!.nodeData!.audioFile!;
      const duration = audioFile.buffer.duration;
      regionPlaceholder!.style.width = `${duration * props.scale * TIMELINE_FACTOR_PX}px`;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (startDragTimeout.current !== null) {
      window.clearTimeout(startDragTimeout.current);
      startDragTimeout.current = null;
    }

    if (isDragging && dragTarget.current === e.target) {
      setIsDragging(false);
      dragTarget.current!.releasePointerCapture(e.pointerId);
      const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);
      regionPlaceholder!.style.display = 'none';
      dragLabel.current!.style.display = 'none';
      dragTarget.current = null;
      const regionScrollView = document.getElementById(REGION_SCROLL_VIEW_ID);
      const scrollViewRect = regionScrollView!.getBoundingClientRect();

      if (
        e.clientX >= scrollViewRect.left &&
        e.clientX <= scrollViewRect.right &&
        e.clientY >= scrollViewRect.top &&
        e.clientY <= scrollViewRect.bottom
      ) {
        const isMidi = currentTreeNode.current!.nodeData!.isMidi;

        if (isMidi) {
          props.createNewTracksFromMidi(currentTreeNode.current!.id as string);
        } else {
          const effectiveX = e.clientX - scrollViewRect.left + regionScrollView!.scrollLeft;
          const startTime = effectiveX / props.scale / TIMELINE_FACTOR_PX;
          const timelineSettings = new TimelineSettings(props.scale);
          const location = timelineSettings.snap(
            startTime,
            props.end,
            props.timeSignature,
            props.converter,
          );
          const effectiveY = e.clientY - scrollViewRect.top + regionScrollView!.scrollTop;
          const trackIndex = Math.floor(effectiveY / TRACK_HEIGHT_PX);
          const audioFile = currentTreeNode.current!.nodeData!.audioFile!;
          const audioDuration = audioFile.buffer.duration;
          const endTime = startTime + audioDuration;
          const endLocation = props.converter.convertTime(endTime);
          const duration = location.diff(endLocation, props.timeSignature);

          if (trackIndex >= props.tracks.length) {
            props.createNewAudioTrackWithRegion(audioFile, location, duration);
          } else {
            if (props.tracks[trackIndex].type === 'audio') {
              props.addRegionToTrack(audioFile, trackIndex, location, duration);
            }
          }
        }
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragging && dragTarget.current === e.target) {
      dragLabel.current!.style.left = `${e.clientX}px`;
      dragLabel.current!.style.top = `${e.clientY}px`;
      const regionScrollView = document.getElementById(REGION_SCROLL_VIEW_ID);
      const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);
      const scrollViewRect = regionScrollView!.getBoundingClientRect();

      if (
        e.clientX >= scrollViewRect.left &&
        e.clientX <= scrollViewRect.right &&
        e.clientY >= scrollViewRect.top &&
        e.clientY <= scrollViewRect.bottom
      ) {
        regionPlaceholder!.style.display = 'block';
        regionPlaceholder!.style.left = `${
          e.clientX - scrollViewRect.left + regionScrollView!.scrollLeft - 2
        }px`;
        regionPlaceholder!.style.top = `${
          e.clientY - scrollViewRect.top + regionScrollView!.scrollTop - 2
        }px`;
      } else {
        regionPlaceholder!.style.display = 'none';
      }
    }
  }

  const handleNodeMouseEnter = (node: TreeNodeInfo<NodeData>, _nodePath: NodePath) => {
    currentTreeNode.current = node;
    dragLabelText.current = node.label as string;
    if (canDrag(node)) {
      const element = tree.current!.getNodeContentElement(node.id as string);
      element?.classList.add(styles.canDrag);
    }
  };

  const handleNodeMouseLeave = (node: TreeNodeInfo<NodeData>, _nodePath: NodePath) => {
    if (currentTreeNode.current !== null) {
      const element = tree.current!.getNodeContentElement(node.id as string);
      element?.classList.remove(styles.canDrag);
      currentTreeNode.current = null;
    }
    if (startDragTimeout.current !== null) {
      window.clearTimeout(startDragTimeout.current);
      startDragTimeout.current = null;
    }
  };

  return (
    <div
      id={BROWSER_DRAG_DIV_ID}
      className={styles.browser}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Tree
        ref={tree}
        contents={nodes}
        onNodeClick={handleNodeClick}
        onNodeCollapse={handleNodeCollapse}
        onNodeExpand={handleNodeExpand}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
      />
      <div
        ref={dragLabel}
        className={`${styles.dragLabel} ${styles.noselect}`}
        style={{ top: 0, left: 0, display: 'none' }}
      >
        <Icon icon="music" /> {dragLabelText.current}
      </div>
    </div>
  );
};