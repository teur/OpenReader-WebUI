# Use Node.js slim image
FROM node:current-alpine

# Add ffmpeg and libreoffice using Alpine package manager
RUN apk add --no-cache ffmpeg libreoffice-writer

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3003

# Start the application
CMD ["npm", "start"]