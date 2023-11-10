# Use the appropriate base image based on the architecture
ARG ARCH
FROM node:21${ARCH:+-$ARCH}

# Install Google Chrome
RUN if [ "$ARCH" = "amd64" ]; then \
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
        && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
        && apt-get update \
        && apt-get install -y google-chrome-stable xvfb; \
    elif [ "$ARCH" = "arm64" ]; then \
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
        && echo "deb [arch=arm64] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
        && apt-get update \
        && apt-get install -y google-chrome-stable xvfb; \
    else \
        echo "Unsupported architecture: $ARCH"; \
        exit 1; \
    fi

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies with yarn
RUN yarn --network-timeout 1000000

# Copy the rest of the code
COPY . .

# Select xvfb as the default virtual screen
ENV DISPLAY=:99

# Set the DBUS_SESSION_BUS_ADDRESS to /dev/null to prevent errors
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null

# Make the docker-entrypoint.sh script executable
RUN chmod a+x docker-entrypoint.sh

# Serve the app
ENTRYPOINT ["bash", "docker-entrypoint.sh", "yarn", "start"]