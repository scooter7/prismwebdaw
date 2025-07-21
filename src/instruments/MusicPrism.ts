import { Instrument } from '../core/Instrument';

export class MusicPrism implements Instrument {
    readonly name = 'Music Prism';
    private context: AudioContext | null = null;
    private wamInstance: any = null;
    private wamNode: AudioNode | null = null;
    private wamGui: HTMLElement | null = null;

    async initialize(context: AudioContext): Promise<void> {
        this.context = context;
        
        // IMPORTANT: Replace this URL with the actual URL of your hosted Music Prism WAM.
        // This should point to the main JavaScript file for your plugin.
        const wamUrl = 'https://main.d2z11ads4dq6v1.amplifyapp.com/index.js';

        try {
            // Using a dynamic import with a webpack hint to treat it as a runtime URL.
            const { default: WamConstructor } = await import(/* webpackIgnore: true */ wamUrl);
            
            const hostGroupId = `com.webdaw.host-${Math.floor(Math.random() * 1000000)}`;

            // We cast the instance to `any` to avoid type checking issues with the SDK.
            const wamInstance: any = await WamConstructor.createInstance(hostGroupId, this.context);
            this.wamInstance = wamInstance;

            if (this.wamInstance) {
                // The property is `_audioNode` in this version of the SDK.
                this.wamNode = this.wamInstance._audioNode;
                this.wamGui = await this.wamInstance.createGui();
            }

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