import { Instrument } from '../core/Instrument';
import { WebAudioModule } from '@webaudiomodules/sdk';

export class MusicPrism implements Instrument {
    readonly name = 'Music Prism';
    private context: AudioContext | null = null;
    private wamInstance: WebAudioModule | null = null;
    private wamNode: AudioNode | null = null;
    private wamGui: HTMLElement | null = null;

    async initialize(context: AudioContext): Promise<void> {
        this.context = context;
        
        // This is a placeholder URL for a known working WAM.
        // You may need to replace this with the correct URL for your Music Prism WAM.
        const wamUrl = 'https://main.d2z11ads4dq6v1.amplifyapp.com/index.js';

        try {
            // Using a dynamic import to load the WAM module.
            const { default: WamConstructor } = await import(wamUrl);
            
            const hostGroupId = `com.webdaw.host-${Math.floor(Math.random() * 1000000)}`;

            this.wamInstance = await WamConstructor.createInstance(hostGroupId, this.context);
            this.wamNode = this.wamInstance.audioNode;

            // Create the GUI but don't attach it yet.
            this.wamGui = await this.wamInstance.createGui();

        } catch (error) {
            console.error(`Failed to load Music Prism WAM from ${wamUrl}:`, error);
            throw new Error('Could not load the Music Prism instrument.');
        }
    }

    connect(destination: AudioNode): void {
        this.wamNode?.connect(destination);
    }

    disconnect(): void {
        this.wamNode?.disconnect();
    }

    noteOn(note: number, velocity: number, time: number): void {
        if (!this.wamInstance) return;

        const midiEvent = {
            type: 'midi',
            data: [0x90, note, velocity], // Note On, channel 1
        };
        this.wamInstance.scheduleEvents({ ...midiEvent, time });
    }

    noteOff(note: number, time: number): void {
        if (!this.wamInstance) return;

        const midiEvent = {
            type: 'midi',
            data: [0x80, note, 0], // Note Off, channel 1
        };
        this.wamInstance.scheduleEvents({ ...midiEvent, time });
    }

    stopAll(): void {
        if (!this.wamInstance || !this.context) return;
        
        const now = this.context.currentTime;
        for (let channel = 0; channel < 16; channel++) {
            const midiEvent = {
                type: 'midi',
                data: [0xB0 + channel, 123, 0], // All notes off on this channel
            };
            this.wamInstance.scheduleEvents({ ...midiEvent, time: now });
        }
    }

    public getGui(): HTMLElement | null {
        return this.wamGui;
    }
}