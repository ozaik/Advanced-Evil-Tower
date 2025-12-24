FROM mcr.microsoft.com/playwright:v1.57.0-jammy

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    xvfb x11vnc novnc websockify \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY start.sh server.js ./
RUN chmod +x /app/start.sh

EXPOSE 3000 6080
CMD ["/app/start.sh"]
