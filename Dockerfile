## Dockerfile for xssScanService
##
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm
RUN         pacman -S --noconfirm nodejs npm && \
            addgroup -S xssscanservice && adduser -S -G xssscanservice -g "xssScanService user" -s /bin/bash -h /opt/xssScanService xssscanservice
COPY        . /opt/xssScanService
WORKDIR     /opt/xssScanService
USER        xssscanservice
RUN         npm install
CMD         ["/bin/startProdServer.sh", "start"]
