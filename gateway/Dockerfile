FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY index.js db.js ./
EXPOSE 8080
CMD ["node", "index.js"]
