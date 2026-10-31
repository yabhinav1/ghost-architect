# Ghost-Architect needs git and a writable .cache, so it runs on a VM or container
# host (Railway, Fly, Render), not on serverless platforms like Vercel.
FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
