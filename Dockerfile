FROM node:18-slim
WORKDIR /usr/src/app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "./node_modules/.bin/probot", "run", "-H", "0.0.0.0", "./index.js"]
