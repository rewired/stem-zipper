declare module 'yazl' {
  type ZipFileAddOptions = {
    compress?: boolean;
    mtime?: Date;
    mode?: number;
  };

  type ZipFileEndOptions = {
    forceZip64Format?: boolean;
  };

  export class ZipFile {
    outputStream: NodeJS.ReadableStream;
    addFile(realPath: string, metadataPath: string, options?: ZipFileAddOptions): void;
    addBuffer(data: Buffer | Uint8Array, metadataPath: string, options?: ZipFileAddOptions): void;
    addReadStream(stream: NodeJS.ReadableStream, metadataPath: string, options?: ZipFileAddOptions): void;
    end(options?: ZipFileEndOptions): void;
  }
}
