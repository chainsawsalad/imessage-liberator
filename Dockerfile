FROM buildpack-deps:jessie

# gpg keys listed at https://github.com/nodejs/node
RUN set -ex \
  && for key in \
    9554F04D7259F04124DE6B476D5A82AC7E37093B \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    0034A06D9D9B0064CE8ADF6BF1747F4AD2306D93 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
  ; do \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key"; \
  done

ENV NPM_CONFIG_LOGLEVEL info
ENV NODE_VERSION 6.3.1

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v$NODE_VERSION-linux-x64.tar.xz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt

CMD [ "node" ]

# end copied docker file (remove when https://github.com/node-inspector/node-inspector/issues/905 is fixed)
#FROM node:6
#MAINTAINER Jeff Colombo <jeff@colombo.us>

RUN mkdir -p /var/temp/npm \
  && cd /var/temp/npm \
  && npm install npm \
  && cd $(npm root -g) \
  && cd .. \
  && rm -rf node_modules \
  && mv /var/temp/npm/node_modules . \
  && rm -rf /var/temp/npm && \
#RUN npm install -g npm --loglevel warn && \
  npm install -g node-inspector nodemon forever --loglevel warn && \
  mkdir -p /usr/src/app && \
  touch /var/log/node.log

ADD package.json /usr/src/package.json
RUN cd /usr/src && \
  npm install --loglevel warn

ENV NODE_PATH /usr/src/node_modules
WORKDIR /usr/src/app/

CMD npm start
