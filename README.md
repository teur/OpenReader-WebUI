[![GitHub Stars](https://img.shields.io/github/stars/richardr1126/OpenReader-WebUI)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/richardr1126/OpenReader-WebUI)](../../network/members)
[![GitHub Watchers](https://img.shields.io/github/watchers/richardr1126/OpenReader-WebUI)](../../watchers)
[![GitHub Issues](https://img.shields.io/github/issues/richardr1126/OpenReader-WebUI)](../../issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/richardr1126/OpenReader-WebUI)](../../commits)
[![GitHub Release](https://img.shields.io/github/v/release/richardr1126/OpenReader-WebUI)](../../releases)

[![Docker Image Size](https://img.shields.io/docker/image-size/richardr1126/openreader-webui/latest)](https://hub.docker.com/r/richardr1126/openreader-webui)
[![Docker Image Version](https://img.shields.io/docker/v/richardr1126/openreader-webui/latest?label=latest%20docker)](https://hub.docker.com/r/richardr1126/openreader-webui/tags)
[![Docker Hub](https://img.shields.io/docker/pulls/richardr1126/openreader-webui)](https://hub.docker.com/r/richardr1126/openreader-webui)


# OpenReader WebUI 📄🔊

OpenReader WebUI is a document reader with Text-to-Speech capabilities, offering a TTS read along experience with narration for both PDF and EPUB documents. It can use any OpenAI compatible TTS endpoint, including [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI/tree/v0.0.5post1-stable).

- 🎯 **TTS API Integration**: Compatible with OpenAI text to speech API, Kokoro FastAPI TTS, or any other compatible service; enabling high-quality voice narration
- 💾 **Local-First Architecture**: Uses IndexedDB browser storage - no server uploads required
- 🛜 **Optional Server-side documents**: Manually upload documents to the next backend for all users to download
- 🔍 **Smart Text Processing**: Splits content into sentence blocks (ePub tries to split at paragraphs)
- 📚 **EPUB Support**: Read EPUB files with table of contents and synchronized text
- 📄 **PDF Support**: Read PDF files with text extraction and page navigation
  - 💬 Follow along with highlighted text as the TTS narrates
- 📲 **Mobile Support**: Works on mobile devices, and can be added as a PWA web app
- 🎨 **Customizable Experience**: 
  - 🔑 Set TTS API base URL (with optional API key)
  - 🏎️ Adjustable playback speed
  - 🗣️ Multiple voice options (checks `/v1/audio/voices` endpoint)
  - 🎨 Multiple app theme options

## [**Demo**](https://openreader.richardr.dev/)


https://github.com/user-attachments/assets/262b9a01-c608-4fee-893c-9461dd48c99b


## 🐳 Docker Quick Start

```bash
docker run --name openreader-webui \
  -p 3003:3003 \
  -v openreader_docstore:/app/docstore \
  richardr1126/openreader-webui:latest
```

(Optionally): Set the TTS `API_BASE` URL and/or `API_KEY` to be default for all devices
```bash
docker run --name openreader-webui \
  -e API_BASE=http://host.docker.internal:8880/v1 \
  -p 3003:3003 \
  -v openreader_docstore:/app/docstore \
  richardr1126/openreader-webui:latest
```

> Requesting audio from the TTS API happens on the Next.js server not the client. So the base URL for the TTS API should be accessible and relative to the Next.js server. If it is in a Docker you may need to use `host.docker.internal` to access the host machine, instead of `localhost`.

Visit [http://localhost:3003](http://localhost:3003) to run the app and set your settings.

> **Note:** The `openreader_docstore` volume is used to store server-side documents. You can mount a local directory instead. Or remove it if you don't need server-side documents.

### ⬆️ Update Docker Image
```bash
docker stop openreader-webui && docker rm openreader-webui
docker pull richardr1126/openreader-webui:latest
```

### Adding to a Docker Compose (i.e. with open-webui or Kokoro-FastAPI)
Create or add to a `docker-compose.yml`:
```yaml
volumes:
  docstore:

services:
  openreader-webui:
    container_name: openreader-webui
    image: richardr1126/openreader-webui:latest
    environment:
      - API_BASE=http://host.docker.internal:8880/v1
    ports:
      - "3003:3003"
    volumes:
      - docstore:/app/docstore
    restart: unless-stopped
```

## Dev Installation

### Prerequisites
- Node.js & npm (recommended: use [nvm](https://github.com/nvm-sh/nvm))

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/richardr1126/OpenReader-WebUI.git
   cd OpenReader-WebUI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the environment:
   ```bash
   cp .env.template .env
   # Edit .env with your configuration settings
   ```
   > Note: The base URL for the TTS API should be accessible and relative to the Next.js server

4. Start the development server:
   ```bash
   npm run dev
   ```

   or build and run the production server:
   ```bash
   npm run build
   npm start
   ```

   Visit [http://localhost:3003](http://localhost:3003) to run the app.

   > Dev server runs on port 3000 by default, while the production server runs on port 3003.


## 💡 Feature requests

For feature requests or ideas you have for the project, please use the [Discussions](https://github.com/richardr1126/OpenReader-WebUI/discussions) tab.

## 🙋‍♂️ Support and issues

For general questions, you can reach out to me on [Bluesky](https://bsky.app/profile/richardr.dev). If you encounter issues, please open an issue on GitHub following the template (which is very simple).

## 👥 Contributing

Contributions are welcome! Fork the repository and submit a pull request with your changes.

## ❤️ Acknowledgements

- [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) for the API wrapper
- [react-pdf](https://github.com/wojtekmaj/react-pdf)
- [react-reader](https://github.com/happyr/react-reader)
- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) for text-to-speech

## Docker Supported Architectures
- linux/amd64 (x86_64)
- linux/arm64 (Apple Silicon)
- linux/arm/v7 (Raspberry Pi)

## Stack

- **Framework:** Next.js (React)
- **Containerization:** Docker
- **Storage:** IndexedDB (in browser db store)
- **PDF:** 
  - [react-pdf](https://github.com/wojtekmaj/react-pdf)
  - [pdf.js](https://mozilla.github.io/pdf.js/)
- **EPUB:**
  - [react-reader](https://github.com/happyr/react-reader)
  - [epubjs](https://github.com/futurepress/epub.js/)
- **UI:** 
  - [Tailwind CSS](https://tailwindcss.com)
  - [Headless UI](https://headlessui.com)
- **TTS:** (tested on)
  - [OpenAI API](https://platform.openai.com/docs/api-reference/text-to-speech)
  - [Kokoro FastAPI TTS](https://github.com/remsky/Kokoro-FastAPI/tree/v0.0.5post1-stable)
- **NLP:** [compromise](https://github.com/spencermountain/compromise) NLP library for sentence splitting

## License

This project is licensed under the MIT License.
