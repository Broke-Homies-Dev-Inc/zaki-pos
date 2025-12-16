# Use Node 20 LTS base image
FROM node:20-bookworm

# Set working directory inside the container
WORKDIR /app

# Copy only package files first (better caching)
COPY package*.json ./

# --- Force development mode and include devDependencies ---
ENV NODE_ENV=development
ENV NPM_CONFIG_INCLUDE=dev

# Install dependencies (including devDependencies)
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi

# Copy the rest of the application code
COPY . .

# Expose your backend port
EXPOSE 4000

# Default command to start the dev server
CMD ["npm", "run", "dev"]