# -----------------------------------
# STAGE 1: Build the highly-optimized UI
# -----------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies rapidly grabbing layers
COPY package*.json ./
RUN npm ci

# Copy full React source 
COPY . .

# IMPORTANT: Bake the API routing directly into the build execution limits matching your Nginx reverse-proxies / domains
ENV VITE_API_URL=/api/v1 
RUN npm run build

# -----------------------------------
# STAGE 2: Serve natively through Alpine NGINX
# -----------------------------------
FROM nginx:alpine

# Purge default html rendering
RUN rm -rf /usr/share/nginx/html/*

# Load the SPA distribution
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
