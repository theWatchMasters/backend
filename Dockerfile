FROM node:22.22.0-alpine
WORKDIR /app
COPY package.json yarn.lock /app/
RUN corepack enable
RUN yarn config set enableScripts true
RUN yarn install --immutable
COPY . . 
EXPOSE 3001
CMD ["sh", "./entrypoint.sh"]