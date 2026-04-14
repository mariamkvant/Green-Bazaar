FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.json
# v2 - force rebuild
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
