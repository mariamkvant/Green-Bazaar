FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.json
# v3 - cache bust
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
