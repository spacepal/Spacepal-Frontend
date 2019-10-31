FROM node:10.16.3 as builder

WORKDIR /app
COPY . ./
RUN npm install
RUN npm run build

FROM nginx:1.15
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist/ /usr/share/nginx/html
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf