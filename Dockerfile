FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.json
# Static files (index.html, app.js, etc.) are at /app/
# Compiled server is at /app/dist/server/index.js
# Server resolves __dirname/../.. = /app/
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
