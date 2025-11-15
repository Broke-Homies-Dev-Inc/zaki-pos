# ---- Development stage ----
FROM node:20-bookworm

# Set working directory
WORKDIR /app

# Copy only package files first (for caching)
COPY package*.json ./

# Install all dependencies (not using npm ci so we can edit freely)
RUN npm install

# Copy the rest of the project files
COPY . .

# Expose the Vite development port (default is 5173)
EXPOSE 5173

# Run Vite in dev mode
CMD ["npm", "run", "dev:vite", "--", "--host"]
