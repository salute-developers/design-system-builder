FROM node:22-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm ci

COPY --chown=node:node . .

RUN npm run build

RUN npm ci --only=production

EXPOSE 3001

CMD ["npm", "run", "migrate", "&&", "npm", "start"]