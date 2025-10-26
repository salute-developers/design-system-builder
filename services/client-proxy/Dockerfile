FROM node:22-alpine

# Default BACKEND_URL - can be overridden by docker-compose environment variables
ENV BACKEND_URL=https://plasma-db-service.dev.app.sberdevices.ru/api

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm ci

COPY --chown=node:node . .

RUN npm run build

RUN npm ci --only=production

EXPOSE 3003

CMD ["npm", "start"]



