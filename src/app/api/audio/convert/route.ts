import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir, unlink, rmdir, readdir } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ConversionRequest {
  chapterTitle: string;
  buffer: number[];
  bookId?: string;
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

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const data: ConversionRequest = await request.json();
    
    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir);
    }

    // Generate or use existing book ID
    const bookId = data.bookId || randomUUID();
    const intermediateDir = join(tempDir, `${bookId}-intermediate`);
    
    // Create intermediate directory
    if (!existsSync(intermediateDir)) {
      await mkdir(intermediateDir);
    }

    // Count existing files to determine chapter index
    const files = await readdir(intermediateDir);
    const wavFiles = files.filter(f => f.endsWith('.wav'));
    const chapterIndex = wavFiles.length;

    // Write input file
    const inputPath = join(intermediateDir, `${chapterIndex}-input.aac`);
    const outputPath = join(intermediateDir, `${chapterIndex}.wav`);
    const metadataPath = join(intermediateDir, `${chapterIndex}.meta.json`);
    
    // Write the chapter audio to a temp file
    await writeFile(inputPath, Buffer.from(new Uint8Array(data.buffer)));
    
    // Convert to WAV from raw aac with consistent format
    await runFFmpeg([
      '-i', inputPath,
      '-f', 'wav',
      '-c:a', 'copy',
      '-preset', 'ultrafast',
      '-threads', '0',
      outputPath
    ]);

    // Get the duration and save metadata
    const duration = await getAudioDuration(outputPath);
    await writeFile(metadataPath, JSON.stringify({
      title: data.chapterTitle,
      duration,
      index: chapterIndex
    }));

    // Clean up input file
    await unlink(inputPath).catch(console.error);

    return NextResponse.json({ 
      bookId,
      chapterIndex,
      duration
    });

  } catch (error) {
    console.error('Error processing audio chapter:', error);
    return NextResponse.json(
      { error: 'Failed to process audio chapter' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const bookId = request.nextUrl.searchParams.get('bookId');
    if (!bookId) {
      return NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
    }

    const tempDir = join(process.cwd(), 'temp');
    const intermediateDir = join(tempDir, `${bookId}-intermediate`);
    const outputPath = join(tempDir, `${bookId}.m4b`);
    const metadataPath = join(tempDir, `${bookId}-metadata.txt`);
    const listPath = join(tempDir, `${bookId}-list.txt`);

    if (!existsSync(intermediateDir)) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Read all chapter metadata
    const files = await readdir(intermediateDir);
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));
    const chapters: { title: string; duration: number; index: number }[] = [];
    
    for (const metaFile of metaFiles) {
      const meta = JSON.parse(await readFile(join(intermediateDir, metaFile), 'utf-8'));
      chapters.push(meta);
    }

    // Sort chapters by index
    chapters.sort((a, b) => a.index - b.index);

    // Create chapter metadata file
    const metadata: string[] = [];
    let currentTime = 0;
    
    // Calculate chapter timings based on actual durations
    chapters.forEach((chapter) => {
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
    await writeFile(
      listPath,
      chapters.map(c => `file '${join(intermediateDir, `${c.index}.wav`)}'`).join('\n')
    );

    // Combine all files into a single M4B
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-i', metadataPath,
      '-map_metadata', '1',
      '-c:a', 'copy', // c:a is codec for audio and :a is stream specifier
      //'-codec', 'wav',
      //'-b:a', '192k',
      //'-threads', '0', // Use maximum available threads
      //'-movflags', '+faststart',
      //'-preset', 'ultrafast', // Use fastest encoding preset
      outputPath
    ]);

    // Stream the file back to the client
    const stream = createReadStream(outputPath);
    
    // Clean up function
    const cleanup = async () => {
      try {
        await Promise.all([
          ...chapters.map(c => unlink(join(intermediateDir, `${c.index}.wav`))),
          ...chapters.map(c => unlink(join(intermediateDir, `${c.index}.meta.json`))),
          unlink(metadataPath),
          unlink(listPath),
          unlink(outputPath),
          rmdir(intermediateDir)
        ]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    };

    // Clean up after streaming is complete
    stream.on('end', cleanup);

    const readableWebStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(readableWebStream, {
      headers: {
        'Content-Type': 'audio/mp4',
      },
    });

  } catch (error) {
    console.error('Error creating M4B:', error);
    return NextResponse.json(
      { error: 'Failed to create M4B file' }, 
      { status: 500 }
    );
  }
}