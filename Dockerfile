## Dockerfile for xssScanService
## 
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm --noprogressbar
RUN         pacman -S --noconfirm --noprogressbar npm nodejs chromium
RUN         /usr/bin/groupadd -r xssscanservice && /usr/bin/useradd -r -g xssscanservice -c "xssScanService user" -m -s /bin/bash -d /opt/xssScanService xssscanservice
COPY        . /opt/xssScanService
RUN         chown -R xssscanservice:xssscanservice /opt/xssScanService
WORKDIR     /opt/xssScanService
USER        xssscanservice
RUN         npm install
EXPOSE      8099
CMD         ["/usr/bin/node", "dist/xssScanService.js", "--perf", "--return-errors", "-p", "8099", "--browserpath", "/usr/bin/chromium", "--no-sandbox", "--no-listen-localhost"]
