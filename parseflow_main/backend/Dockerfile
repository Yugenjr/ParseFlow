FROM node:20-bullseye-slim

WORKDIR /app/backend

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/storage /app/backend/uploads

EXPOSE 5000

CMD ["npm", "start"]