## Dockerfile for xssScanService
##
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm --noprogressbar
RUN         pacman --asdeps --noconfirm --noprogressbar npm
RUN         pacman -S --noconfirm --noprogressbar nodejs
RUN         /usr/bin/groupadd -r xssscanservice && /usr/bin/useradd -r -g xssscanservice -c "xssScanService user" -m -s /bin/bash -d /opt/xssScanService xssscanservice
COPY        . /opt/xssScanService
RUN         chown -R xssscanservice:xssscanservice /opt/xssScanService
WORKDIR     /opt/xssScanService
USER        xssscanservice
RUN         npm install
EXPOSE      8099
CMD         ["/usr/bin/node", "dist/xssScanService.js", "--perf", "--returnerrors", "-p", "8099"]
