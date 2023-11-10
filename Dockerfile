# Use Node.js 21 as the base image
FROM node:21

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable xvfb

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies with yarn
RUN yarn --network-timeout 1000000

# Build the app
RUN yarn build

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