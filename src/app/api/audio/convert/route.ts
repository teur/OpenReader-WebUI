import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir, unlink, rmdir } from 'fs/promises';
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

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
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
    
    // Create intermediate directory
    if (!existsSync(intermediateDir)) {
      await mkdir(intermediateDir);
    }

    // First, write each chapter to a temporary file and get its duration
    const chapterFiles: { path: string; title: string; duration: number }[] = [];
    let currentTime = 0;

    for (let i = 0; i < data.chapters.length; i++) {
      const chapter = data.chapters[i];
      const inputPath = join(intermediateDir, `${i}-input.aac`);
      const outputPath = join(intermediateDir, `${i}.wav`);
      
      // Write the chapter audio to a temp file
      await writeFile(inputPath, Buffer.from(new Uint8Array(chapter.buffer)));
      
      // Convert to WAV with consistent format (this helps with timestamp issues)
      await runFFmpeg([
        '-i', inputPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ]);
      
      // Get the duration of this chapter
      const duration = await getAudioDuration(outputPath);
      
      chapterFiles.push({
        path: outputPath,
        title: chapter.title,
        duration
      });

      // Clean up input file
      await unlink(inputPath).catch(console.error);
    }

    // Create chapter metadata file
    const metadata: string[] = [];
    metadata.push(
      `title=Kokoro Audiobook`,
      `artist=KokoroTTS`,
    );
    
    // Calculate chapter timings based on actual durations
    chapterFiles.forEach((chapter, index) => {
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

    // Read the converted file
    const m4bData = await readFile(outputPath);

    // Clean up temp files
    await Promise.all([
      ...chapterFiles.map(f => unlink(f.path)),
      unlink(metadataPath),
      unlink(listPath),
      unlink(outputPath),
      rmdir(intermediateDir)
    ].map(p => p.catch(console.error)));

    return new NextResponse(m4bData, {
      headers: {
        'Content-Type': 'audio/mp4',
      },
    });
  } catch (error) {
    console.error('Error converting audio:', error);
    return NextResponse.json(
      { error: 'Failed to convert audio format' }, 
      { status: 500 }
    );
  }
}