# Stage 1: Build the SPA static assets
FROM node:18-alpine AS build-stage
WORKDIR /app

# Copy dependency files and install packages
COPY package*.json ./
RUN npm ci

# Copy full source and build
COPY . .
RUN npm run build

# Stage 2: Serve using high-performance lightweight Nginx
FROM nginx:1.25-alpine AS production-stage

# Copy the build artifacts from the build-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Setup Nginx Dynamic Port Template
# The official Nginx image (since 1.19) automatically parses templates in /etc/nginx/templates/
# replacing variables like ${PORT} and generating the actual configuration in /etc/nginx/conf.d/
COPY <<EOF /etc/nginx/templates/default.conf.template
server {
    listen \${PORT};
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Set default PORT environment variable to 3000
ENV PORT=3000

# Expose port
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
