FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=4174
EXPOSE 4174
CMD ["node", "server.js"]
