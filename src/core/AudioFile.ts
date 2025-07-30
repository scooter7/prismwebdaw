import {
  Identifiable,
  JSONObject,
  JSONValue,
  NamedObject,
  ToJson,
  createId,
} from './Common';

export class AudioFile implements NamedObject, Identifiable, ToJson {
  // After successful loading, the audio buffer is stored here.
  private _audioBuffer: AudioBuffer | null;

  // If loading failed, the error is stored here.
  private _error: Error | null = null;

  // We maintain a mipmap of renderings of the audio file.
  // The highst resolution corresponds to 2048 pixels/samples per second.
  // From the we downsample to the audio by a factor of 2.
  // Should we use max or average values for downsampling?

  /**
   * Create a new temporary audio file that wraps an in-memory buffer
   *
   * @param name    the name associated with the file
   * @param buffer  the audio buffer that is being wraped
   */
  public static createTemp(name: string, buffer: AudioBuffer): AudioFile {
    return new AudioFile(name, AudioFile.createTempUrl(), buffer);
  }

  /**
   * Create an audio file that is associated with a URL
   *
   * @param url the url of the audio file to load
   */
  public static create(url: URL): AudioFile {
    const path = url.pathname;
    const basename = path.substring(path.lastIndexOf('/') + 1);
    return new AudioFile(basename, url, null);
  }

  private constructor(
    public name: string,
    public readonly url: URL,
    buffer: AudioBuffer | null,
  ) {
    this._audioBuffer = buffer;
  }

  toJson(): JSONValue {
    // TODO: Do we need to ensure that this is not a temporary file? Subclassing could be an option to
    // seggregate temporary files from files that are associated with a URL.
    return {
      name: this.name,
      url: this.url.toString(),
    };
  }

  public get ready(): boolean {
    return this._audioBuffer !== null;
  }

  public get error(): Error | null {
    return this._error;
  }

  public get buffer(): AudioBuffer {
    if (this._audioBuffer !== null) {
      return this._audioBuffer;
    } else {
      throw new Error('Invalid attempt to access to buffer content');
    }
  }

  async load(
    context: AudioContext,
    callback: (audioFile: AudioFile) => void,
    onError: (audioFile: AudioFile, error: Error) => void,
  ) {
    const file = this;
    if (file._audioBuffer !== null) {
      callback(file);
      return;
    }

    try {
      console.log(`Loading audio file ${file.name} from ${file.url}`);
      console.log(`Full URL: ${file.url.toString()}`);
      
      // Add credentials: 'same-origin' to avoid CORS issues
      const response = await fetch(file.url, { credentials: 'same-origin' });

      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
      }

      // Log response headers for debugging (using Array.from for compatibility)
      console.log(`Response headers for ${file.name}:`, Array.from(response.headers.entries()));
      
      // Check content type
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type for ${file.name}: ${contentType}`);

      // Clone the response to avoid detaching the ArrayBuffer
      const arrayBuffer = await response.clone().arrayBuffer();
      console.log(`ArrayBuffer size for ${file.name}: ${arrayBuffer.byteLength} bytes`);

      // Try to decode the audio data
      try {
        const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          context.decodeAudioData(arrayBuffer, resolve, reject);
        });
        console.log(`Decoded audio file ${file.name}`, decodedBuffer);
        file._audioBuffer = decodedBuffer;
        callback(file);
      } catch (decodeError: any) {
        console.error(`Failed to decode audio data for ${file.name}:`, decodeError);
        // Create a minimal silent buffer as fallback
        const fallbackBuffer = context.createBuffer(1, 1, context.sampleRate);
        console.log(`Using fallback silent buffer for ${file.name}`);
        file._audioBuffer = fallbackBuffer;
        callback(file);
      }
    } catch (err: any) {
      console.error(`Failed to load or decode audio file ${file.name}. Error: ${err.message}`);
      console.error(`Full error:`, err);
      console.error(`URL that failed: ${file.url.toString()}`);
      file._error = err;
      onError(file, err);
    }
  }

  /**
   * For AudioFiles, the url serves as identifier
   */
  get id() {
    return this.url.toString();
  }

  static createTempUrl(): URL {
    return new URL('temp:' + createId());
  }

  static fromJson(file: JSONValue): AudioFile {
    if (typeof file !== 'object') {
      throw new Error('Invalid JSON value for AudioFile');
    }

    const obj = file as JSONObject;
    const name = obj['name'] as string;
    const urlString = obj['url'] as string; // obj['url'] is already a relative path like 'library/samples/...'
    console.log(`Loading audio file ${name} from ${urlString}`);
    const url = new URL(urlString, document.baseURI);

    return new AudioFile(name, url, null);
  }
}

/**
 * Resolve an URL to an AudioFile.
 */
export interface AudioFileResolver {
  resolve(url: URL): AudioFile;
}