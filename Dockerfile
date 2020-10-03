## Dockerfile for xssScanService
## 
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm --noprogressbar
RUN         pacman -S --noconfirm --noprogressbar npm nodejs chromium
RUN         /usr/bin/groupadd -r xssscanservice && /usr/bin/useradd -r -g xssscanservice -c "xssScanService user" -m -s /bin/bash -d /opt/xssScanService xssscanservice
COPY        ["LICENSE", "README.md", "package.json", "package-lock.json", "/opt/xssScanService/"]
COPY        ["dist", "/opt/xssScanService/dist"]
RUN         chown -R xssscanservice:xssscanservice /opt/xssScanService
WORKDIR     /opt/xssScanService
USER        xssscanservice
RUN         npm install
EXPOSE      8099
ENTRYPOINT  ["/usr/bin/node", "dist/xssScanService.js", "-p", "8099", "--no-listen-localhost"]