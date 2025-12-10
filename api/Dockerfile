FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy TypeScript source and config
COPY tsconfig.json ./tsconfig.json
COPY src ./src

# Build TypeScript -> JavaScript
RUN npm run build

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
