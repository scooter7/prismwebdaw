// src/ui/Browser.tsx

import React, {
  FunctionComponent,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Icon, Tree, TreeNodeInfo, Spinner } from '@blueprintjs/core';
import { cloneDeep } from 'lodash';
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
  TIMELINE_FACTOR_PX,
  TRACK_HEIGHT_PX,
} from './Config';
import styles from './Browser.module.css';
import { AudioFile } from '../core/AudioFile';
import { AudioContextContext } from './Context';
import { TrackInterface } from '../core/Track';

export type NodePath = number[];

type NodeData = {
  audioFile?: AudioFile;
  isMidi?: boolean;
  isLoading?: boolean;
} | null;

function canDrag(node: TreeNodeInfo<NodeData>) {
  if (node.nodeData?.isMidi) return true;
  return !!node.nodeData?.audioFile?.ready && !node.nodeData.isLoading;
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
    duration: Duration
  ) => void;
  addRegionToTrack: (
    region: AudioFile,
    trackIndex: number,
    location: Location,
    duration: Duration
  ) => void;
  createNewTracksFromMidi: (url: string) => void;
};

type TreeAction =
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_IS_EXPANDED'; payload: { path: NodePath; isExpanded: boolean } }
  | { type: 'SET_IS_SELECTED'; payload: { path: NodePath; isSelected: boolean } }
  | { type: 'RELOAD_TREE_NODES'; payload: { nodes: TreeNodeInfo<NodeData>[] } }
  | { type: 'START_LOAD'; payload: { path: NodePath; audioFile: AudioFile } }
  | { type: 'FINISH_LOAD'; payload: { path: NodePath; success: boolean } };

function forEachNode(
  nodes: TreeNodeInfo<NodeData>[] | undefined,
  fn: (node: TreeNodeInfo<NodeData>) => void
) {
  if (!nodes) return;
  for (const n of nodes) {
    fn(n);
    forEachNode(n.childNodes, fn);
  }
}

function forNodeAtPath(
  nodes: TreeNodeInfo<NodeData>[],
  path: NodePath,
  fn: (node: TreeNodeInfo<NodeData>) => void
) {
  fn(Tree.nodeFromPath(path, nodes)!);
}

function treeReducer(
  state: TreeNodeInfo<NodeData>[],
  action: TreeAction
): TreeNodeInfo<NodeData>[] {
  const newState = cloneDeep(state);
  switch (action.type) {
    case 'DESELECT_ALL':
      forEachNode(newState, n => (n.isSelected = false));
      return newState;

    case 'SET_IS_EXPANDED':
      forNodeAtPath(newState, action.payload.path, n => {
        n.isExpanded = action.payload.isExpanded;
        if (n.childNodes?.length) {
          n.icon = action.payload.isExpanded ? 'folder-open' : 'folder-close';
        }
      });
      return newState;

    case 'SET_IS_SELECTED':
      forNodeAtPath(newState, action.payload.path, n => {
        n.isSelected = action.payload.isSelected;
      });
      return newState;

    case 'RELOAD_TREE_NODES':
      return action.payload.nodes;

    case 'START_LOAD':
      forNodeAtPath(newState, action.payload.path, n => {
        n.nodeData = n.nodeData || {};
        n.nodeData.audioFile = action.payload.audioFile;
        n.nodeData.isLoading = true;
        n.icon = <Spinner size={16} />;
      });
      return newState;

    case 'FINISH_LOAD':
      forNodeAtPath(newState, action.payload.path, n => {
        if (n.nodeData) n.nodeData.isLoading = false;
        n.icon = action.payload.success ? 'music' : 'error';
      });
      return newState;

    default:
      return state;
  }
}

function jsonToTreeNodes(json: any): TreeNodeInfo<NodeData> {
  if (json.children) {
    const isRoot = json.name.toLowerCase() === 'library';
    return {
      id: json.path,
      label: json.name,
      isExpanded: isRoot,
      icon: isRoot ? 'folder-open' : 'folder-close',
      childNodes: json.children.map(jsonToTreeNodes),
      nodeData: null,
    };
  }

  const prefix = process.env.PUBLIC_URL || '';
  const raw = `${prefix}/${json.path}`.replace(/\/+/g, '/');
  const lower = (json.name || '').toLowerCase();
  const isMidi = lower.endsWith('.mid') || lower.endsWith('.midi');

  return {
    id: raw,
    label: json.name,
    isExpanded: false,
    icon: isMidi ? 'document' : 'music',
    nodeData: { isMidi, isLoading: false },
  };
}

export const Browser: FunctionComponent<BrowserProps> = props => {
  const audioContext = useContext(AudioContextContext)!;
  const [nodes, dispatch] = useReducer(treeReducer, []);

  const treeRef = useRef<Tree<NodeData>>(null);
  const dragLabel = useRef<HTMLDivElement>(null);
  const dragLabelText = useRef<string>('');
  const currentTreeNode = useRef<TreeNodeInfo<NodeData> | null>(null);
  const startDragTimeout = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── FETCH library.json ─────────────────────────────────────────────────────
  useEffect(() => {
    const libUrl = `${process.env.PUBLIC_URL || ''}/${LIBRARY_JSON}`.replace(/\/+/g, '/');
    console.log('Fetching library.json at', libUrl);

    fetch(libUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json =>
        dispatch({
          type: 'RELOAD_TREE_NODES',
          payload: { nodes: [jsonToTreeNodes(json)] },
        })
      )
      .catch(err => {
        console.error('Failed to load library.json', err);
        dispatch({
          type: 'RELOAD_TREE_NODES',
          payload: {
            nodes: [
              {
                id: 'error',
                label: 'Error loading library',
                isExpanded: false,
                icon: 'error',
                nodeData: null,
              },
            ],
          },
        });
      });
  }, []);

  // ─── DRAG HANDLERS ────────────────────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.preventDefault();
      dragLabel.current!.style.display = 'block';
      dragLabel.current!.style.left = `${e.clientX}px`;
      dragLabel.current!.style.top = `${e.clientY}px`;

      const ph = document.getElementById(REGION_PLACEHOLDER_ID)!;
      if (currentTreeNode.current!.nodeData!.isMidi) {
        ph.style.width = '120px';
      } else {
        const dur = currentTreeNode.current!.nodeData!.audioFile!.buffer.duration;
        ph.style.width = `${dur * props.scale * TIMELINE_FACTOR_PX}px`;
      }
    },
    [props.scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging && currentTreeNode.current && canDrag(currentTreeNode.current)) {
        startDragTimeout.current = window.setTimeout(
          () => onStartDrag(e),
          CLICK_TO_DRAG_TIMEOUT_MS
        );
      }
    },
    [isDragging, onStartDrag]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        dragLabel.current!.style.left = `${e.clientX}px`;
        dragLabel.current!.style.top = `${e.clientY}px`;
      }
    },
    [isDragging]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startDragTimeout.current) {
        clearTimeout(startDragTimeout.current);
        startDragTimeout.current = null;
      }
      if (isDragging) {
        setIsDragging(false);
        dragLabel.current!.style.display = 'none';
        document.getElementById(REGION_PLACEHOLDER_ID)!.style.display = 'none';
      }
    },
    [isDragging]
  );

  // ─── TREE EVENTS ─────────────────────────────────────────────────────────────
  const handleNodeMouseEnter = useCallback(
    (node: TreeNodeInfo<NodeData>) => {
      currentTreeNode.current = node;
      dragLabelText.current = node.label as string;
      if (canDrag(node)) {
        treeRef.current!
          .getNodeContentElement(node.id as string)!
          .classList.add(styles.canDrag);
      }
    },
    []
  );

  const handleNodeMouseLeave = useCallback(
    (node: TreeNodeInfo<NodeData>) => {
      treeRef.current!
        .getNodeContentElement(node.id as string)!
        .classList.remove(styles.canDrag);
      currentTreeNode.current = null;
      if (startDragTimeout.current) {
        clearTimeout(startDragTimeout.current);
        startDragTimeout.current = null;
      }
    },
    []
  );

  const handleNodeCollapse = useCallback(
    (_n: TreeNodeInfo<NodeData>, path: NodePath) => {
      dispatch({ type: 'SET_IS_EXPANDED', payload: { path, isExpanded: false } });
    },
    []
  );

  const handleNodeExpand = useCallback(
    (_n: TreeNodeInfo<NodeData>, path: NodePath) => {
      dispatch({ type: 'SET_IS_EXPANDED', payload: { path, isExpanded: true } });
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: TreeNodeInfo<NodeData>, path: NodePath, e: React.MouseEvent<HTMLElement>) => {
      if (!e.shiftKey) dispatch({ type: 'DESELECT_ALL' });
      dispatch({ type: 'SET_IS_SELECTED', payload: { path, isSelected: !node.isSelected } });

      if (
        !node.nodeData?.isMidi &&
        node.nodeData &&
        !node.nodeData.isLoading &&
        !node.nodeData.audioFile
      ) {
        const f = AudioFile.create(new URL(String(node.id), document.baseURI));
        dispatch({ type: 'START_LOAD', payload: { path, audioFile: f } });
        f.load(
          audioContext,
          () => dispatch({ type: 'FINISH_LOAD', payload: { path, success: true } }),
          () => dispatch({ type: 'FINISH_LOAD', payload: { path, success: false } })
        );
      }
    },
    [audioContext]
  );

  return (
    <div
      id="browser-drag-div"
      className={styles.browser}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Tree
        ref={treeRef}
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
        style={{ display: 'none', top: 0, left: 0 }}
      >
        <Icon icon="music" /> {dragLabelText.current}
      </div>
    </div>
  );
};

export default Browser;
