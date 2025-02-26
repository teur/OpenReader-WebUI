import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, mkdir, unlink, rmdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface Chapter {
  title: string;
  buffer: number[];
}

interface ConversionRequest {
  chapters: Chapter[];
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-i', filePath,
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'csv=p=0'
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(new Error(`ffprobe process exited with code ${code}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(err);
    });
  });
}

async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

async function cleanup(files: string[], directories: string[]) {
  await Promise.all([
    ...files.map(f => unlink(f).catch(console.error)),
    ...directories.map(d => rmdir(d).catch(console.error))
  ]);
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];
  const tempDirs: string[] = [];

  try {
    // Parse the request body as a stream
    const data: ConversionRequest = await request.json();
    
    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir);
    }

    // Generate unique filenames
    const id = randomUUID();
    const outputPath = join(tempDir, `${id}.m4b`);
    const metadataPath = join(tempDir, `${id}.txt`);
    const intermediateDir = join(tempDir, `${id}-intermediate`);
    
    tempFiles.push(outputPath, metadataPath);
    tempDirs.push(intermediateDir);

    // Create intermediate directory
    if (!existsSync(intermediateDir)) {
      await mkdir(intermediateDir);
    }

    // Process chapters sequentially to avoid memory issues
    const chapterFiles: { path: string; title: string; duration: number }[] = [];
    let currentTime = 0;

    for (let i = 0; i < data.chapters.length; i++) {
      const chapter = data.chapters[i];
      const inputPath = join(intermediateDir, `${i}-input.mp3`);
      const outputPath = join(intermediateDir, `${i}.wav`);
      
      tempFiles.push(inputPath, outputPath);

      // Write the chapter audio to a temp file using a Buffer chunk size of 64KB
      const chunkSize = 64 * 1024; // 64KB chunks
      const buffer = Buffer.from(new Uint8Array(chapter.buffer));
      const chunks: Buffer[] = [];
      
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        chunks.push(buffer.slice(offset, offset + chunkSize));
      }
      
      await writeFile(inputPath, Buffer.concat(chunks));
      chunks.length = 0; // Clear chunks array

      // Convert to WAV with consistent format
      await runFFmpeg([
        '-i', inputPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ]);
      
      const duration = await getAudioDuration(outputPath);
      
      chapterFiles.push({
        path: outputPath,
        title: chapter.title,
        duration
      });

      // Clean up input file early
      await unlink(inputPath).catch(console.error);
      const index = tempFiles.indexOf(inputPath);
      if (index > -1) {
        tempFiles.splice(index, 1);
      }
    }

    // Create chapter metadata file
    const metadata: string[] = [];
    
    chapterFiles.forEach((chapter) => {
      const startMs = Math.floor(currentTime * 1000);
      currentTime += chapter.duration;
      const endMs = Math.floor(currentTime * 1000);

      metadata.push(
        `[CHAPTER]`,
        `TIMEBASE=1/1000`,
        `START=${startMs}`,
        `END=${endMs}`,
        `title=${chapter.title}`
      );
    });
    
    await writeFile(metadataPath, ';FFMETADATA1\n' + metadata.join('\n'));

    // Create list file for concat
    const listPath = join(tempDir, `${id}-list.txt`);
    tempFiles.push(listPath);
    
    await writeFile(
      listPath,
      chapterFiles.map(f => `file '${f.path}'`).join('\n')
    );

    // Combine all files into a single M4B
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-i', metadataPath,
      '-map_metadata', '1',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    ]);

    // Create a readable stream from the output file
    const fileStream = createReadStream(outputPath);

    // Create a web-compatible ReadableStream from the Node.js stream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        
        fileStream.on('end', () => {
          controller.close();
          // Clean up only after the stream has been fully sent
          cleanup(tempFiles, tempDirs).catch(console.error);
        });
        
        fileStream.on('error', (error) => {
          console.error('Stream error:', error);
          controller.error(error);
          cleanup(tempFiles, tempDirs).catch(console.error);
        });
      },
      cancel() {
        fileStream.destroy();
        cleanup(tempFiles, tempDirs).catch(console.error);
      }
    });

    // Return the streaming response
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Transfer-Encoding': 'chunked'
      },
    });

  } catch (error) {
    // Clean up in case of error
    await cleanup(tempFiles, tempDirs).catch(console.error);
    
    console.error('Error converting audio:', error);
    return NextResponse.json(
      { error: 'Failed to convert audio format' }, 
      { status: 500 }
    );
  }
}