import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

const TEMP_DIR = path.join(process.cwd(), 'temp');

async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

async function convertDocxToPdf(inputPath: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('soffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outputDir,
      inputPath
    ]);

    process.on('error', (error) => {
      reject(error);
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`LibreOffice conversion failed with code ${code}`));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureTempDir();
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json(
        { error: 'File must be a .docx document' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempId = randomUUID();
    const inputPath = path.join(TEMP_DIR, `${tempId}.docx`);
    const outputPath = path.join(TEMP_DIR, `${tempId}.pdf`);

    // Write the uploaded file
    await writeFile(inputPath, buffer);

    try {
      // Convert the file
      await convertDocxToPdf(inputPath, TEMP_DIR);

      // Return the PDF file
      const pdfContent = await readFile(outputPath);
      
      // Clean up temp files
      await Promise.all([
        unlink(inputPath),
        unlink(outputPath)
      ]).catch(console.error);

      return new NextResponse(pdfContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${path.parse(file.name).name}.pdf"`
        }
      });
    } catch (error) {
      // Clean up temp files on error
      await Promise.all([
        unlink(inputPath),
        unlink(outputPath)
      ]).catch(console.error);
      
      throw error;
    }
  } catch (error) {
    console.error('Error converting DOCX to PDF:', error);
    return NextResponse.json(
      { error: 'Failed to convert document' },
      { status: 500 }
    );
  }
}