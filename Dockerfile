FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.json
# v4 - rebuild with all features
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
