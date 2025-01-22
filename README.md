# OpenReader WebUI

OpenReader WebUI is a web-based PDF reader with integrated Text-to-Speech capabilities. It provides a clean interface for reading PDF documents while offering synchronized text-to-speech playback using OpenAI's TTS API.

## Demo

https://github.com/user-attachments/assets/7a3457ba-feda-4939-928a-cb587b1c0884

## Features

- **PDF Document Management**
  - Local document storage using IndexedDB
  - PDF text extraction and rendering

- **Text-to-Speech Integration**
  - Real-time text-to-speech using OpenAI's TTS API, Kokoro TTS API, or anything else that follows the OpenAI API format
  - Synchronized text highlighting
  - Configurable playback speed
  - Multiple voice options
  - Click-to-read functionality

- **User Interface**
  - Light/Dark/System theme support
  - Responsive design
  - Configurable API settings
  - Interactive PDF text selection

## Tech Stack

- **Framework**: Next.js with React
- **Storage**: IndexedDB for document storage
- **PDF Processing**: 
  - react-pdf for rendering
  - pdf.js for text extraction
  - compromise for text analysis
- **UI Components**: 
  - Headless UI for modals and dropdowns
  - Tailwind CSS for styling
- **TTS Integration**: OpenAI TTS API

## Installation

> You will need `node` and `npm` installed on your machine. If you don't have it, I recommend installing it using [nvm](https://github.com/nvm-sh/nvm).


1. Clone the repository:
```bash
git clone https://github.com/richardr1126/OpenReader-WebUI.git
cd OpenReader-WebUI
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.template .env
```
> Edit the `.env` file with your configuration settings.

4. Start the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

## Project Structure

```
src/
├── app/                    # Next.js app router
├── components/             # UI components
├── contexts/               # Contexts for state management
└── services/               # Utility functions
```

## Browser Support

The application requires modern browser features:
- IndexedDB for document storage
- PDF.js for document rendering

## License

MIT License

## Acknowledgements

- [react-pdf](https://github.com/wojtekmaj/react-pdf) for the PDF rendering library.
- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) text-to-speech model
- [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI/tree/master) for the text-to-speech api wrapper.

Thank you ❤️
