import { FunctionComponent, useEffect, useRef } from 'react';
import { MusicPrism } from '../instruments/MusicPrism';

export interface WamGuiProps {
    instrument: MusicPrism;
}

export const WamGui: FunctionComponent<WamGuiProps> = ({ instrument }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const gui = instrument.getGui();
        if (gui && containerRef.current) {
            // Clear previous GUI and append the new one
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(gui);
        }
    }, [instrument]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }} />;
};