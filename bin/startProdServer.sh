#!/usr/bin/env bash

set +m
(shopt >/dev/null 2>&1) && shopt -s lastpipe

function cmdNotFound() {
    missingCmd=${1}
    echo "Required command not found: ${missingCmd}" 2>&1
}

function getBaseDir() {
    BASEDIR="$(${DIRNAME} $0)"
    cd ${BASEDIR}/..
    pwd -P
}

ENV=/usr/bin/env
STARTPARMS=""
SERVERDIR=/usr/local/xssCheckServer
NODEJS=/usr/local/bin/node
DIRNAME=$(${ENV} which dirname 2>/dev/null || exit 1) || (cmdNotFound dirname && exit 1) || exit 1
PKILL=$(${ENV} which pkill 2>/dev/null || exit 1) || (cmdNotFound pkill && exit 1) || exit 1

getBaseDir | read BASEDIR
if [ -e ${BASEDIR}/bin/prodServer.local.conf ]; then
    . ${BASEDIR}/bin/prodServer.local.conf
fi

if [ ! -e ${NODEJS} ]; then
    NODEJS=$(${ENV} which node 2>/dev/null || exit 1) || (cmdNotFound node && exit 1) || exit 1
fi

if [ "x${LISTENPORT}" != "x" ]; then
    STARTPARMS="${STARTPARMS} -p ${LISTENPORT}"
fi

if [ "x${LISTENHOST}" != "x" ]; then
    STARTPARMS="${STARTPARMS} -l ${LISTENHOST}"
fi

if [ "x${SHOWERRORS}" = "xtrue" ]; then
    STARTPARMS="${STARTPARMS} --return-errors"
fi

if [ "x${SHOWWARNINGS}" = "xtrue" ]; then
    STARTPARMS="${STARTPARMS} --return-warnings"
fi

if [ "x${SHOWPERFORMANCE}" = "xtrue" ]; then
    STARTPARMS="${STARTPARMS} --perf"
fi

if [ "x${ENABLECACHING}" = "xtrue" ]; then
    STARTPARMS="${STARTPARMS} --cache"
fi

if [ "x${BROWSERPATH}" != "x" ]; then
    STARTPARMS="${STARTPARMS} --browserpath ${BROWSERPATH}"
fi

if [ "x${BROWSERTYPE}" != "x" ]; then
    STARTPARMS="${STARTPARMS} --browsertype ${BROWSERTYPE}"
fi

if [ "x${BLOCKLIST}" != "x" ]; then
    for DOMAIN in ${BLOCKLIST}; do
        STARTPARMS="${STARTPARMS} -b ${DOMAIN}"
    done
fi

case "${1}" in
    start)
        ${NODEJS} ${BASEDIR}/dist/xssScanService.js ${STARTPARMS}
    ;;
    stop)
        ${PKILL} node
    ;;
    *)
        echo "Usage: $0 [start|stop]"
    ;;
esac