FROM rust:bookworm

# Install base utils
RUN apt-get update
RUN apt-get install -y \
  curl \
  psmisc

# Install Deno
ENV DENO_INSTALL=/usr/local/deno
ENV PATH="$PATH:$DENO_INSTALL/bin"
RUN curl -fsSL https://deno.land/install.sh | sh

# Install Tauri v2 dependencies
# https://v2.tauri.app/start/prerequisites/#linux
RUN apt-get install -y libwebkit2gtk-4.1-dev \
  build-essential \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Install Deno dependencies
RUN apt-get install -y protobuf-compiler \
  clang \
  xdg-utils

# NOTE(sasetz): linuxdeploy doesn't work, probably won't work and we don't
# really need it. Just in case, leaving this here

# # Install linuxdeploy (no FUSE mode)
# RUN wget -O /tmp/linuxdeploy-x86_64.AppImage \
#       https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage && \
#     chmod +x /tmp/linuxdeploy-x86_64.AppImage && \
#     /tmp/linuxdeploy-x86_64.AppImage --appimage-extract && \
#     mv squashfs-root /opt/linuxdeploy && \
#     ln -s /opt/linuxdeploy/AppRun /usr/local/bin/linuxdeploy && \
#     rm /tmp/linuxdeploy-x86_64.AppImage
#
# # Install appimage plugin the same way (optional but recommended)
# RUN wget -O /tmp/linuxdeploy-plugin-appimage-x86_64.AppImage \
#       https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage && \
#     chmod +x /tmp/linuxdeploy-plugin-appimage-x86_64.AppImage && \
#     /tmp/linuxdeploy-plugin-appimage-x86_64.AppImage --appimage-extract && \
#     mv squashfs-root /opt/linuxdeploy-plugin-appimage && \
#     ln -s /opt/linuxdeploy-plugin-appimage/AppRun /usr/local/bin/linuxdeploy-plugin-appimage && \
#     rm /tmp/linuxdeploy-plugin-appimage-x86_64.AppImage

WORKDIR /app

CMD ["deno", "task", "dev"]
